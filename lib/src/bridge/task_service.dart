/// 任务卡列表与「在壳里开跑」的编排。
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:conatus/conatus.dart';
import 'package:http/http.dart' as http;

import '../runner/abort_signal.dart';
import '../runner/agent_task_body.dart';
import '../runner/approval_bridge.dart';
import '../runner/llm_config.dart';
import '../runner/llm_runtime.dart';
import '../runner/run_paths.dart';
import '../runner/run_store.dart';
import '../runner/runner.dart';
import '../runner/task_spec.dart';
import 'bridge_error.dart';
import 'projection_events.dart';
import 'projection_io.dart';
import 'projection_payload.dart';
import 'run_watch.dart';

/// 一张可执行的任务卡。
class TaskCard {
  const TaskCard({
    required this.id,
    required this.title,
    required this.chain,
    required this.path,
  });

  /// 任务卡 id（文件名去掉扩展名）。
  final String id;

  /// 人可读标题。
  final String title;

  /// 所属任务链。
  final String chain;

  /// 任务卡文件路径。
  final String path;

  Map<String, Object?> toJson() => <String, Object?>{
    'id': id,
    'title': title,
    'chain': chain,
    'path': path,
  };
}

/// 在壳内启动真实运行，并把运行期事件推给调用方。
class TaskService {
  TaskService({
    required this.runsDir,
    required this.tasksDir,
    this.body,
    this.pollInterval = const Duration(milliseconds: 250),
    Map<String, String>? env,
    LlmProvider? provider,
    this.workspacesDir,
    this.clientFactory,
  }) : _env = env ?? Platform.environment,
       _provider = provider;

  /// `var/runs` 位置。
  final String runsDir;

  /// 任务卡目录。
  final String tasksDir;

  /// 执行体；缺省用真实 Agent，测试可注入脚本化实现。
  final TaskBody? body;

  /// 尾随日志的轮询间隔。
  final Duration pollInterval;

  /// 未指定工作区时，在这里为每次运行新建一个干净目录。
  final String? workspacesDir;

  final Map<String, String> _env;
  final LlmProvider? _provider;

  /// 每次运行一个 HTTP 客户端，取消时直接关闭，放弃在途请求。
  final http.Client Function()? clientFactory;
  final Map<String, LlmRuntime> _runtimes = <String, LlmRuntime>{};
  final Map<String, RunEventStream> _streams = <String, RunEventStream>{};
  final Map<String, _PendingApproval> _approvals = <String, _PendingApproval>{};
  final Set<String> _resolvedApprovals = <String>{};
  int _extraSeq = 0;

  /// 列出任务卡（读不到的文件跳过）。
  List<TaskCard> cards() {
    final Directory dir = Directory(tasksDir);
    if (!dir.existsSync()) return <TaskCard>[];
    final List<TaskCard> cards = <TaskCard>[];
    for (final FileSystemEntity entity in dir.listSync()) {
      if (entity is! File || !entity.path.endsWith('.json')) continue;
      final Map<String, Object?>? json = readJsonObject(entity.path);
      if (json == null) continue;
      final String name = entity.uri.pathSegments.last;
      cards.add(
        TaskCard(
          id: name.substring(0, name.length - 5),
          title: json['title'] is String
              ? json['title']! as String
              : name.substring(0, name.length - 5),
          chain: json['chain'] is String ? json['chain']! as String : '',
          path: entity.path,
        ),
      );
    }
    cards.sort((TaskCard a, TaskCard b) => a.id.compareTo(b.id));
    return cards;
  }

  /// 按任务卡 id 开跑，立即返回 runId；事件通过 [onEvent] 增量推送。
  Future<String> start({
    required String cardId,
    required void Function(Map<String, Object?>) onEvent,
    String? workspaceRoot,
  }) async {
    final String path = _cardPath(cardId);
    final TaskSpec task = await TaskSpec.load(path);
    final LlmRuntime runtime = _runtime();
    final String runId = newRunId(DateTime.now());
    _runtimes[runId] = runtime;
    final RunPaths paths = RunPaths(runsDir: runsDir, runId: runId);
    final String? freshRoot = workspaceRoot == null
        ? _freshWorkspace(task.id, runId)
        : null;
    final String? root = workspaceRoot ?? freshRoot;
    final String? fixture = freshRoot == null ? null : _fixtureFor(task);

    void emit(Map<String, Object?> event) =>
        onEvent(<String, Object?>{...event, 'runId': runId});

    emit(<String, Object?>{
      'seq': -1,
      'at': 0,
      'type': 'task/started',
      'data': <String, Object?>{
        'taskId': task.id,
        'title': task.title,
        'chain': task.chain,
        'model': _env['WORK_LLM_MODEL'] ?? '',
        'startedAt': DateTime.now().toIso8601String(),
      },
    });

    emit(<String, Object?>{
      'seq': -2,
      'at': 0,
      'type': 'task/status',
      'data': <String, Object?>{'status': 'running'},
    });

    unawaited(_execute(task, path, runId, paths, emit, root, runtime, fixture));
    return runId;
  }

  /// 请求中断；返回收口后的状态。未知 run 抛 [BridgeError]。
  Future<String> cancel(String runId) async {
    if (_streams.containsKey(runId) || _runtimes.containsKey(runId)) {
      await _requestAbort(runId);
      return 'aborted';
    }
    final RunRecord record = await _loadRecord(runId);
    if (record.status != TaskRunStatus.running) return record.status.name;
    if (!pidAlive(record.pid)) {
      final RunRecord aborted = await Runner(
        body: body ?? agentTaskBody,
        runsDir: runsDir,
      ).abort(runId);
      return aborted.status.name;
    }
    await _requestAbort(runId);
    return 'aborted';
  }

  Future<void> _requestAbort(String runId) async {
    _denyPending(runId);
    _runtimes[runId]?.abortInFlight();
    final RunPaths paths = RunPaths(runsDir: runsDir, runId: runId);
    final File flag = File(paths.abortFlagPath);
    await flag.parent.create(recursive: true);
    await flag.writeAsString('');
  }

  /// 回应一条待审批请求。[decision] 只接受 `allow` / `deny`。
  Future<void> respondApproval(String requestId, String decision) async {
    if (decision != 'allow' && decision != 'deny') {
      throw ApprovalError('INTERNAL', '未知审批决定：$decision');
    }
    final _PendingApproval? pending = _approvals.remove(requestId);
    if (pending == null) {
      if (_resolvedApprovals.contains(requestId)) {
        throw const ApprovalError('DENIED', '该审批请求已处理');
      }
      throw ApprovalError('NOT_FOUND', '未知审批请求：$requestId');
    }
    _resolvedApprovals.add(requestId);
    pending.emit(
      _extraEvent('approval/resolved', pending.runId, <String, Object?>{
        'requestId': requestId,
        'name': pending.name,
        'decision': decision,
      }),
    );
    pending.completer.complete(decision == 'allow');
  }

  /// 在已结束的 run 上追加一条用户消息并继续执行；事件从 `onEvent` 增量推送。
  Future<void> send(
    String runId,
    String text, {
    required void Function(Map<String, Object?>) onEvent,
  }) async {
    if (text.trim().isEmpty) {
      throw const BridgeError('INTERNAL', '发送内容不能为空');
    }
    final RunRecord record = await _loadRecord(runId);
    if (_streams.containsKey(runId) ||
        (record.status == TaskRunStatus.running && pidAlive(record.pid))) {
      throw const BridgeError('DENIED', '该运行仍在执行，先停止再发送');
    }
    final LlmRuntime runtime;
    try {
      runtime = _runtime();
    } on StateError catch (error) {
      throw BridgeError('INTERNAL', error.message);
    }
    final RunPaths paths = RunPaths(runsDir: runsDir, runId: runId);
    final String startedAt = record.startedAt.toIso8601String();
    final int startSeq = buildEventStream(
      readJsonLines(paths.eventsPath),
      startedAt,
    ).length;
    final RunEventStream stream = RunEventStream(
      path: paths.eventsPath,
      startedAt: startedAt,
      startSeq: startSeq,
    );
    _streams[runId] = stream;
    _runtimes[runId] = runtime;
    void emit(Map<String, Object?> event) =>
        onEvent(<String, Object?>{...event, 'runId': runId});
    emit(
      _extraEvent('task/status', runId, <String, Object?>{'status': 'running'}),
    );
    await stream.start(emit, interval: pollInterval, startAtEnd: true);
    unawaited(_continueRun(record, text, paths, stream, emit, runtime));
  }

  Future<void> _continueRun(
    RunRecord record,
    String text,
    RunPaths paths,
    RunEventStream stream,
    void Function(Map<String, Object?>) emit,
    LlmRuntime runtime,
  ) async {
    try {
      final RunnerApproval approval = RunnerApproval(
        onRequest: (ApprovalRequest request) =>
            _requestApproval(record.runId, request, emit),
      );
      final RunRecord updated =
          await Runner(
            body: body ?? agentTaskBody,
            runsDir: runsDir,
            llm: runtime,
          ).continueRun(
            record.runId,
            text,
            onStream: (LlmStreamEvent event) {
              if (event is LlmTextDelta) stream.emitDelta(event.text);
            },
            approval: approval,
          );
      stream.stop();
      for (final Map<String, Object?> event in _tail(
        updated,
        paths,
        stream.seq,
      )) {
        emit(event);
      }
    } on Object catch (error) {
      stream.stop();
      emit(<String, Object?>{
        'seq': stream.seq,
        'at': 0,
        'type': 'task/ended',
        'data': <String, Object?>{
          'status': 'failed',
          'endedAt': DateTime.now().toIso8601String(),
          'failure': <String, Object?>{
            'category': 'internal',
            'message': '$error',
          },
        },
      });
    } finally {
      _denyPending(record.runId);
      _streams.remove(record.runId);
      _runtimes.remove(record.runId)?.abortInFlight();
    }
  }

  Future<RunRecord> _loadRecord(String runId) async {
    if (runId.isEmpty || runId.contains('/') || runId.contains('..')) {
      throw const BridgeError('NOT_FOUND', '没有这个运行');
    }
    final RunPaths paths = RunPaths(runsDir: runsDir, runId: runId);
    if (!File(paths.runJsonPath).existsSync()) {
      throw BridgeError('NOT_FOUND', '没有这个运行：$runId');
    }
    try {
      return await RunStore(paths).load();
    } on Object {
      throw BridgeError('NOT_FOUND', '运行记录不合法：$runId');
    }
  }

  Future<bool> _requestApproval(
    String runId,
    ApprovalRequest request,
    void Function(Map<String, Object?>) emit,
  ) {
    final Completer<bool> completer = Completer<bool>();
    _approvals[request.id] = _PendingApproval(
      runId: runId,
      name: request.toolName,
      emit: emit,
      completer: completer,
    );
    emit(
      _extraEvent('approval/requested', runId, <String, Object?>{
        'requestId': request.id,
        'callId': request.id,
        'name': request.toolName,
        'args': jsonEncode(request.arguments),
        'riskLevel': 'high',
      }),
    );
    return completer.future.timeout(
      const Duration(minutes: 5),
      onTimeout: () {
        final _PendingApproval? pending = _approvals.remove(request.id);
        if (pending == null) return false;
        _resolvedApprovals.add(request.id);
        pending.emit(
          _extraEvent('approval/resolved', runId, <String, Object?>{
            'requestId': request.id,
            'name': request.toolName,
            'decision': 'deny',
          }),
        );
        return false;
      },
    );
  }

  Map<String, Object?> _extraEvent(
    String type,
    String runId,
    Map<String, Object?> data,
  ) => <String, Object?>{
    'seq': 1000000 + _extraSeq++,
    'at': 0,
    'type': type,
    'runId': runId,
    'data': data,
  };

  void _denyPending(String runId) {
    final List<String> ids = <String>[
      for (final MapEntry<String, _PendingApproval> entry in _approvals.entries)
        if (entry.value.runId == runId) entry.key,
    ];
    for (final String id in ids) {
      final _PendingApproval? pending = _approvals.remove(id);
      if (pending == null) continue;
      _resolvedApprovals.add(id);
      pending.emit(
        _extraEvent('approval/resolved', runId, <String, Object?>{
          'requestId': id,
          'name': pending.name,
          'decision': 'deny',
        }),
      );
      if (!pending.completer.isCompleted) pending.completer.complete(false);
    }
  }

  Future<void> _execute(
    TaskSpec task,
    String cardPath,
    String runId,
    RunPaths paths,
    void Function(Map<String, Object?>) onEvent,
    String? workspaceRoot,
    LlmRuntime runtime,
    String? fixtureDir,
  ) async {
    final RunEventStream stream = RunEventStream(
      path: paths.eventsPath,
      startedAt: DateTime.now().toIso8601String(),
    );
    _streams[runId] = stream;
    final List<Map<String, Object?>> pending = <Map<String, Object?>>[];
    await stream.start((Map<String, Object?> event) {
      pending.add(event);
      onEvent(event);
    }, interval: pollInterval);

    try {
      final RunnerApproval approval = RunnerApproval(
        onRequest: (ApprovalRequest request) =>
            _requestApproval(runId, request, onEvent),
      );
      final RunRecord record =
          await Runner(
            body: body ?? agentTaskBody,
            runsDir: runsDir,
            llm: runtime,
          ).run(
            RunRequest(
              task: task,
              taskPath: cardPath,
              workspaceRoot: workspaceRoot,
              fixtureDir: fixtureDir,
              confirmed: true,
            ),
            runId: runId,
            onStream: (LlmStreamEvent event) {
              if (event is LlmTextDelta) stream.emitDelta(event.text);
            },
            approval: approval,
          );
      stream.stop();
      for (final Map<String, Object?> event in _tail(
        record,
        paths,
        stream.seq,
      )) {
        onEvent(event);
      }
    } on Object catch (error) {
      stream.stop();
      onEvent(<String, Object?>{
        'seq': stream.seq,
        'at': 0,
        'type': 'task/ended',
        'data': <String, Object?>{
          'status': 'failed',
          'endedAt': DateTime.now().toIso8601String(),
          'failure': <String, Object?>{
            'category': 'internal',
            'message': '$error',
          },
        },
      });
    } finally {
      _denyPending(runId);
      _streams.remove(runId);
      _runtimes.remove(runId)?.abortInFlight();
    }
  }

  List<Map<String, Object?>> _tail(RunRecord record, RunPaths paths, int seq) {
    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    int cursor = seq;
    for (final ArtifactCheck artifact in record.artifacts) {
      events.add(<String, Object?>{
        'seq': cursor++,
        'at': 0,
        'type': 'artifact/added',
        'data': artifact.toJson(),
      });
    }
    final Map<String, Object?>? changes = buildChanges(
      record.workspaceRoot,
      readJsonLines(paths.eventsPath),
    );
    if (changes != null) {
      events.add(<String, Object?>{
        'seq': cursor++,
        'at': 0,
        'type': 'changes/updated',
        'data': changes,
      });
    }
    events.add(<String, Object?>{
      'seq': cursor++,
      'at': 0,
      'type': 'usage/updated',
      'data': <String, Object?>{
        'inputTokens': record.inputTokens,
        'outputTokens': record.outputTokens,
        'costUsd': record.costUsd,
      },
    });
    if (record.endTurn != null && record.endTurn! > (record.startTurn ?? 0)) {
      events.add(<String, Object?>{
        'seq': cursor++,
        'at': 0,
        'type': 'checkpoint/recorded',
        'data': <String, Object?>{
          'turn': record.endTurn,
          'startTurn': record.startTurn ?? 0,
          'at': record.endedAt?.toIso8601String() ?? '',
          'eventCount': cursor,
        },
      });
    }
    events.add(<String, Object?>{
      'seq': cursor++,
      'at': 0,
      'type': 'task/ended',
      'data': <String, Object?>{
        'status': record.status.name,
        'endedAt': record.endedAt?.toIso8601String() ?? '',
        'failure': record.failure.toJson(),
      },
    });
    return events;
  }

  /// 没选工作区时给一个干净目录，避免任务卡输入缺失导致预检失败。
  String? _freshWorkspace(String taskId, String runId) {
    final String? base = workspacesDir;
    if (base == null) return null;
    final String dir = '$base/$taskId-$runId';
    Directory(dir).createSync(recursive: true);
    return dir;
  }

  /// 任务卡对应的示例数据目录：`<tasksDir>/fixtures/<chain>/<vNN>`。
  String? _fixtureFor(TaskSpec task) {
    final int dash = task.id.lastIndexOf('-');
    final String suffix = dash >= 0 ? task.id.substring(dash + 1) : '';
    if (suffix.isEmpty) return null;
    final String candidate = '$tasksDir/fixtures/${task.chain}/$suffix';
    return Directory(candidate).existsSync() ? candidate : null;
  }

  String _cardPath(String cardId) {
    if (cardId.isEmpty || cardId.contains('/') || cardId.contains('..')) {
      throw StateError('非法的任务卡：$cardId');
    }
    final String path = '$tasksDir/$cardId.json';
    if (!File(path).existsSync()) throw StateError('找不到任务卡：$cardId');
    return path;
  }

  LlmRuntime _runtime() {
    try {
      return LlmRuntime(
        config: llmConfigFromEnv(_env),
        provider: _provider,
        client: (clientFactory ?? http.Client.new)(),
      );
    } on LlmConfigError catch (error) {
      throw StateError('未配置模型：${error.message}（设置 WORK_LLM_* 后重试）');
    }
  }
}

class _PendingApproval {
  _PendingApproval({
    required this.runId,
    required this.name,
    required this.emit,
    required this.completer,
  });

  final String runId;
  final String name;
  final void Function(Map<String, Object?>) emit;
  final Completer<bool> completer;
}
