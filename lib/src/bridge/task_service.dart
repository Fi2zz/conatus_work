/// 任务卡列表与「在壳里开跑」的编排。
library;

import 'dart:async';
import 'dart:io';

import '../runner/agent_task_body.dart';
import '../runner/run_paths.dart';
import '../runner/run_store.dart';
import '../runner/run_types.dart';
import '../runner/runner.dart';
import '../runner/task_spec.dart';
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
  }) : _env = env ?? Platform.environment;

  /// `var/runs` 位置。
  final String runsDir;

  /// 任务卡目录。
  final String tasksDir;

  /// 执行体；缺省用真实 Agent，测试可注入脚本化实现。
  final TaskBody? body;

  /// 尾随日志的轮询间隔。
  final Duration pollInterval;

  final Map<String, String> _env;
  final Map<String, RunEventStream> _streams = <String, RunEventStream>{};

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
  }) async {
    final String path = _cardPath(cardId);
    final TaskSpec task = await TaskSpec.load(path);
    _requireModel();
    final String runId = newRunId(DateTime.now());
    final RunPaths paths = RunPaths(runsDir: runsDir, runId: runId);

    void emit(Map<String, Object?> event) => onEvent(<String, Object?>{
      ...event,
      'runId': runId,
    });

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

    unawaited(_execute(task, path, runId, paths, emit));
    return runId;
  }

  /// 请求中断；运行器会轮询 `abort.request`。
  Future<void> cancel(String runId) async {
    final RunPaths paths = RunPaths(runsDir: runsDir, runId: runId);
    final File flag = File(paths.abortFlagPath);
    await flag.parent.create(recursive: true);
    await flag.writeAsString('');
  }

  Future<void> _execute(
    TaskSpec task,
    String cardPath,
    String runId,
    RunPaths paths,
    void Function(Map<String, Object?>) onEvent,
  ) async {
    final RunEventStream stream = RunEventStream(
      path: paths.eventsPath,
      startedAt: DateTime.now().toIso8601String(),
    );
    _streams[runId] = stream;
    final List<Map<String, Object?>> pending = <Map<String, Object?>>[];
    await stream.start(
      (Map<String, Object?> event) {
        pending.add(event);
        onEvent(event);
      },
      interval: pollInterval,
    );

    try {
      final RunRecord record = await Runner(
        body: body ?? agentTaskBody,
        runsDir: runsDir,
      ).run(
        RunRequest(task: task, taskPath: cardPath, confirmed: true),
        runId: runId,
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
      _streams.remove(runId);
    }
  }

  List<Map<String, Object?>> _tail(
    RunRecord record,
    RunPaths paths,
    int seq,
  ) {
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
      'type': 'usage/updated',
      'data': <String, Object?>{
        'inputTokens': record.inputTokens,
        'outputTokens': record.outputTokens,
        'costUsd': record.costUsd,
      },
    });
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

  String _cardPath(String cardId) {
    if (cardId.isEmpty || cardId.contains('/') || cardId.contains('..')) {
      throw StateError('非法的任务卡：$cardId');
    }
    final String path = '$tasksDir/$cardId.json';
    if (!File(path).existsSync()) throw StateError('找不到任务卡：$cardId');
    return path;
  }

  void _requireModel() {
    final String? base = _env['WORK_LLM_BASE_URL'];
    final String? model = _env['WORK_LLM_MODEL'];
    if (base == null ||
        base.isEmpty ||
        model == null ||
        model.isEmpty) {
      throw StateError('未配置模型：设置 WORK_LLM_BASE_URL / WORK_LLM_MODEL（及 KEY）后重试');
    }
  }
}
