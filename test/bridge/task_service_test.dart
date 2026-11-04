import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:conatus/conatus.dart';
import 'package:conatus_work/src/bridge/bridge_error.dart';
import 'package:conatus_work/src/bridge/task_service.dart';
import 'package:conatus_work/src/runner/approval_bridge.dart';
import 'package:conatus_work/src/runner/assembly.dart';
import 'package:conatus_work/src/runner/runner.dart';
import 'package:conatus_work/src/runner/task_spec.dart';
import 'package:conatus_work/src/runner/undo.dart';
import 'package:conatus_work/src/tools/rooted_fs.dart';
import 'package:http/http.dart' as http;
import 'package:test/test.dart';

Map<String, Object?> cardJson(String workspaceRoot) => <String, Object?>{
  'id': 'move-v01',
  'chain': 'organize',
  'title': '移动一个文件',
  'workspace': <String, Object?>{
    'root': workspaceRoot,
    'read': <String>['inbox'],
    'write': <String>['inbox', 'out'],
  },
  'inputs': <String>['inbox/a.txt'],
  'prompt': '把 inbox/a.txt 移到 out/',
  'network': 'deny',
  'expectedArtifacts': <String>[],
  'acceptance': <String>[],
  'limits': <String, Object?>{'maxMinutes': 1, 'maxCostUsd': 0.1},
  'checkpoint': <String, Object?>{'enabled': true, 'keep': 30},
};

/// 记录 close 的假客户端：验证取消会放弃在途请求。
class _FakeClient extends http.BaseClient {
  bool closed = false;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    throw UnimplementedError('测试不发真实请求');
  }

  @override
  void close() {
    closed = true;
    super.close();
  }
}

/// 只回一条最终消息的模型：验证执行体拿到了运行时。
class OneShotLlm implements LlmProvider {
  @override
  String get name => 'scripted';

  @override
  Future<LlmResult> chat(
    List<LlmMessage> messages, {
    Map<String, dynamic>? options,
    List<Map<String, dynamic>>? tools,
  }) async => const LlmResult(
    content: '完成',
    provider: 'scripted',
    model: 'scripted',
    usage: <String, dynamic>{'prompt_tokens': 10, 'completion_tokens': 5},
  );

  @override
  Stream<LlmStreamEvent> chatStream(
    List<LlmMessage> messages, {
    Map<String, dynamic>? options,
    List<Map<String, dynamic>>? tools,
  }) => const Stream<LlmStreamEvent>.empty();

  @override
  void close() {}
}

/// 分两段吐正文的流式模型。
class StreamingLlm implements LlmProvider {
  @override
  String get name => 'streaming';

  @override
  Future<LlmResult> chat(
    List<LlmMessage> messages, {
    Map<String, dynamic>? options,
    List<Map<String, dynamic>>? tools,
  }) async => throw StateError('流式用例不应走 chat()');

  @override
  Stream<LlmStreamEvent> chatStream(
    List<LlmMessage> messages, {
    Map<String, dynamic>? options,
    List<Map<String, dynamic>>? tools,
  }) async* {
    yield const LlmTextDelta('你');
    yield const LlmTextDelta('好');
    yield const LlmStreamDone(
      usage: <String, dynamic>{'prompt_tokens': 10, 'completion_tokens': 5},
      model: 'streaming',
    );
  }

  @override
  void close() {}
}

void main() {
  late Directory tmp;
  late String tasksDir;
  late String workspace;

  setUp(() {
    tmp = Directory.systemTemp.createTempSync('tasks_');
    tasksDir = '${tmp.path}/tasks';
    workspace = '${tmp.path}/work';
    Directory(tasksDir).createSync();
    Directory('$workspace/inbox').createSync(recursive: true);
    File('$workspace/inbox/a.txt').writeAsStringSync('a');
    File(
      '$tasksDir/move-v01.json',
    ).writeAsStringSync(jsonEncode(cardJson(workspace)));
  });

  tearDown(() => tmp.deleteSync(recursive: true));

  TaskService service({TaskBody? body, Map<String, String>? env}) =>
      TaskService(
        runsDir: '${tmp.path}/runs',
        tasksDir: tasksDir,
        body: body,
        pollInterval: const Duration(milliseconds: 20),
        env:
            env ??
            <String, String>{
              'WORK_LLM_BASE_URL': 'http://x',
              'WORK_LLM_MODEL': 'm',
            },
      );

  test('cards 列出任务卡', () {
    final List<TaskCard> cards = service().cards();
    expect(cards, hasLength(1));
    expect(cards.single.id, 'move-v01');
    expect(cards.single.title, '移动一个文件');
    expect(cards.single.chain, 'organize');
  });

  test('未配置模型时明确报错', () async {
    final TaskService bare = service(env: <String, String>{});
    await expectLater(
      bare.start(cardId: 'move-v01', onEvent: (_) {}),
      throwsA(isA<StateError>()),
    );
  });

  test('start 立即返回 runId，并在结束后推 task/ended', () async {
    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    final TaskService runner = service(
      body: (RunScope scope, TaskSpec task) async {
        await scope.fs.mkdir('out');
        await scope.fs.move('inbox/a.txt', 'out/a.txt');
        return const TaskOutcome.ok();
      },
    );

    final String runId = await runner.start(
      cardId: 'move-v01',
      onEvent: events.add,
    );
    expect(runId, startsWith('run_'));
    expect(events.first['type'], 'task/started');

    final bool finished = await _waitFor(
      () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
    );
    expect(finished, isTrue, reason: '10 秒内应收到 task/ended');

    final Map<String, Object?> ended = events.last;
    expect(ended['type'], 'task/ended');
    expect((ended['data']! as Map<String, Object?>)['status'], 'succeeded');
    expect(File('${tmp.path}/runs/$runId/run.json').existsSync(), isTrue);
  });

  test('start 的 workspaceRoot 覆盖任务卡里的根', () async {
    final Directory other = Directory('${tmp.path}/other')..createSync();
    Directory('${other.path}/inbox').createSync();
    File('${other.path}/inbox/a.txt').writeAsStringSync('a');
    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    final TaskService runner = service(
      body: (RunScope scope, TaskSpec task) async => const TaskOutcome.ok(),
    );
    final String runId = await runner.start(
      cardId: 'move-v01',
      workspaceRoot: other.path,
      onEvent: events.add,
    );
    final bool finished = await _waitFor(
      () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
    );
    expect(finished, isTrue);
    final Map<String, Object?> run =
        jsonDecode(File('${tmp.path}/runs/$runId/run.json').readAsStringSync())
            as Map<String, Object?>;
    expect(run['workspaceRoot'], other.path);
  });

  test('流式增量与最终消息共用 entryId，并推 task/status running', () async {
    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    final TaskService runner = TaskService(
      runsDir: '${tmp.path}/runs',
      tasksDir: tasksDir,
      pollInterval: const Duration(milliseconds: 20),
      env: <String, String>{
        'WORK_LLM_BASE_URL': 'http://fake',
        'WORK_LLM_MODEL': 'fake',
      },
      provider: StreamingLlm(),
    );
    final String runId = await runner.start(
      cardId: 'move-v01',
      onEvent: events.add,
    );
    final bool finished = await _waitFor(
      () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
    );
    expect(finished, isTrue);
    expect(
      events.any(
        (Map<String, Object?> e) =>
            e['type'] == 'task/status' &&
            (e['data']! as Map<String, Object?>)['status'] == 'running',
      ),
      isTrue,
      reason: '开始执行应推 task/status running，runId=$runId',
    );

    final List<Map<String, Object?>> deltas = events
        .where(
          (Map<String, Object?> e) => e['type'] == 'message/assistant/delta',
        )
        .toList();
    expect(deltas, hasLength(2));
    final Map<String, Object?> done = events.firstWhere(
      (Map<String, Object?> e) => e['type'] == 'message/assistant/done',
    );
    final Map<String, Object?> deltaData =
        deltas.first['data']! as Map<String, Object?>;
    final Map<String, Object?> doneData = done['data']! as Map<String, Object?>;
    expect(doneData['entryId'], deltaData['entryId']);
  });

  test('审批请求可被拒绝，并留下 resolved 事件', () async {
    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    final TaskService runner = service(
      body: (RunScope scope, TaskSpec task) async {
        await scope.ctx.tools.call(
          const ToolCall(
            name: 'apply_patch',
            arguments: <String, Object?>{
              'patch': '*** Begin Patch\n*** End Patch',
            },
          ),
        );
        return const TaskOutcome.ok();
      },
    );
    final String runId = await runner.start(
      cardId: 'move-v01',
      onEvent: events.add,
    );
    final bool requested = await _waitFor(
      () => events.any(
        (Map<String, Object?> e) => e['type'] == 'approval/requested',
      ),
    );
    expect(requested, isTrue, reason: 'apply_patch 应进入审批，runId=$runId');
    final Map<String, Object?> requestedData =
        events.firstWhere(
              (Map<String, Object?> e) => e['type'] == 'approval/requested',
            )['data']!
            as Map<String, Object?>;
    final String requestId = requestedData['requestId']! as String;
    expect(requestedData['name'], 'apply_patch');

    await runner.respondApproval(requestId, 'deny');
    final bool finished = await _waitFor(
      () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
    );
    expect(finished, isTrue);
    final Map<String, Object?> resolvedData =
        events.firstWhere(
              (Map<String, Object?> e) => e['type'] == 'approval/resolved',
            )['data']!
            as Map<String, Object?>;
    expect(resolvedData['requestId'], requestId);
    expect(resolvedData['decision'], 'deny');
  });

  test('未知审批请求给出明确的错误码', () async {
    await expectLater(
      service().respondApproval('approval-nope', 'allow'),
      throwsA(
        isA<ApprovalError>().having(
          (ApprovalError error) => error.code,
          'code',
          'NOT_FOUND',
        ),
      ),
    );
  });

  test('真实执行体拿到模型运行时，不再报「未装配模型」', () async {
    final TaskService runner = TaskService(
      runsDir: '${tmp.path}/runs',
      tasksDir: tasksDir,
      pollInterval: const Duration(milliseconds: 20),
      env: <String, String>{
        'WORK_LLM_BASE_URL': 'http://fake',
        'WORK_LLM_MODEL': 'fake',
      },
      provider: OneShotLlm(),
    );
    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    final String runId = await runner.start(
      cardId: 'move-v01',
      onEvent: events.add,
    );
    final bool finished = await _waitFor(
      () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
    );
    expect(finished, isTrue);
    final Map<String, Object?> ended = events.last;
    final Map<String, Object?> data = ended['data']! as Map<String, Object?>;
    expect(data['status'], 'succeeded', reason: '不应因缺少运行时失败');
    expect(File('${tmp.path}/runs/$runId/run.json').existsSync(), isTrue);
  });

  test('未选工作区时新建干净目录并复制示例数据', () async {
    Directory(
      '$tasksDir/fixtures/organize/v01/inbox',
    ).createSync(recursive: true);
    File('$tasksDir/fixtures/organize/v01/inbox/a.txt').writeAsStringSync('a');

    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    final TaskService runner = TaskService(
      runsDir: '${tmp.path}/runs',
      tasksDir: tasksDir,
      workspacesDir: '${tmp.path}/ws',
      pollInterval: const Duration(milliseconds: 20),
      env: <String, String>{
        'WORK_LLM_BASE_URL': 'http://x',
        'WORK_LLM_MODEL': 'm',
      },
      body: (RunScope scope, TaskSpec task) async => const TaskOutcome.ok(),
    );
    final String runId = await runner.start(
      cardId: 'move-v01',
      onEvent: events.add,
    );
    final bool finished = await _waitFor(
      () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
    );
    expect(finished, isTrue);
    final File record = File('${tmp.path}/runs/$runId/run.json');
    expect(
      record.existsSync(),
      isTrue,
      reason: '最后一条事件：${events.isEmpty ? '无' : events.last}',
    );
    final Map<String, Object?> run =
        jsonDecode(record.readAsStringSync()) as Map<String, Object?>;
    expect(run['status'], 'succeeded');
    expect(run['workspaceRoot'], startsWith('${tmp.path}/ws/move-v01-'));
    expect(File('${run['workspaceRoot']}/inbox/a.txt').existsSync(), isTrue);
  });

  test('cancel 让运行以 aborted 收尾', () async {
    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    final TaskService runner = service(
      body: (RunScope scope, TaskSpec task) async {
        await Future<void>.delayed(const Duration(milliseconds: 400));
        return const TaskOutcome.ok();
      },
    );
    final String runId = await runner.start(
      cardId: 'move-v01',
      onEvent: events.add,
    );
    await Future<void>.delayed(const Duration(milliseconds: 100));
    await runner.cancel(runId);
    final bool finished = await _waitFor(
      () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
    );
    expect(finished, isTrue);
    final Map<String, Object?> data =
        events.last['data']! as Map<String, Object?>;
    expect(data['status'], 'aborted');
  });

  test('cancel 会关掉在途 HTTP 客户端', () async {
    final _FakeClient client = _FakeClient();
    final TaskService runner = TaskService(
      runsDir: '${tmp.path}/runs',
      tasksDir: tasksDir,
      pollInterval: const Duration(milliseconds: 20),
      env: <String, String>{
        'WORK_LLM_BASE_URL': 'http://x',
        'WORK_LLM_MODEL': 'm',
      },
      clientFactory: () => client,
      body: (RunScope scope, TaskSpec task) async {
        await Future<void>.delayed(const Duration(milliseconds: 500));
        return const TaskOutcome.ok();
      },
    );
    final String runId = await runner.start(
      cardId: 'move-v01',
      onEvent: (_) {},
    );
    await Future<void>.delayed(const Duration(milliseconds: 60));
    await runner.cancel(runId);
    expect(client.closed, isTrue);
  });

  test('cancel 写入中断标记', () async {
    final TaskService runner = service(
      body: (RunScope scope, TaskSpec task) async {
        await Future<void>.delayed(const Duration(seconds: 2));
        return const TaskOutcome.ok();
      },
    );
    final String runId = await runner.start(
      cardId: 'move-v01',
      onEvent: (_) {},
    );
    await runner.cancel(runId);
    expect(File('${tmp.path}/runs/$runId/abort.request').existsSync(), isTrue);
  });

  test('send 在已结束 run 上续写并推完整事件链', () async {
    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    final TaskService runner = service(
      body: (RunScope scope, TaskSpec task) async {
        final String? text = scope.userText;
        if (text != null) {
          scope.session.append(
            'user/message',
            data: <String, Object?>{'text': text},
          );
          scope.session.append(
            'assistant/message',
            data: <String, Object?>{'text': '收到'},
          );
        }
        return const TaskOutcome.ok(
          tokens: TokenUsage(prompt: 1, completion: 1),
        );
      },
    );
    final String runId = await runner.start(
      cardId: 'move-v01',
      onEvent: events.add,
    );
    expect(
      await _waitFor(
        () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
      ),
      isTrue,
    );
    events.clear();

    await runner.send(runId, '继续做', onEvent: events.add);
    final bool finished = await _waitFor(
      () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
    );
    expect(finished, isTrue, reason: '续写应产生新的 task/ended');

    final Map<String, Object?> user = events.firstWhere(
      (Map<String, Object?> e) => e['type'] == 'message/user',
    );
    expect((user['data']! as Map<String, Object?>)['text'], '继续做');
    expect(
      events.any(
        (Map<String, Object?> e) => e['type'] == 'message/assistant/done',
      ),
      isTrue,
    );
    expect(
      events.any((Map<String, Object?> e) => e['type'] == 'usage/updated'),
      isTrue,
    );
    expect(
      events.any(
        (Map<String, Object?> e) => e['type'] == 'checkpoint/recorded',
      ),
      isTrue,
    );
    final Map<String, Object?> ended = events.last;
    expect((ended['data']! as Map<String, Object?>)['status'], 'succeeded');
  });

  test('运行中的 run 拒绝 send', () async {
    final TaskService runner = service(
      body: (RunScope scope, TaskSpec task) async {
        await Future<void>.delayed(const Duration(milliseconds: 800));
        return const TaskOutcome.ok();
      },
    );
    final String runId = await runner.start(
      cardId: 'move-v01',
      onEvent: (_) {},
    );
    await Future<void>.delayed(const Duration(milliseconds: 150));
    await expectLater(
      runner.send(runId, '插话', onEvent: (_) {}),
      throwsA(
        isA<BridgeError>().having(
          (BridgeError error) => error.code,
          'code',
          'DENIED',
        ),
      ),
    );
    await runner.cancel(runId);
  });

  test('cancel 未知 run 回 NOT_FOUND', () async {
    await expectLater(
      service().cancel('run_missing'),
      throwsA(
        isA<BridgeError>().having(
          (BridgeError error) => error.code,
          'code',
          'NOT_FOUND',
        ),
      ),
    );
  });

  test('cancel 已结束 run 返回真实状态且不写中断标记', () async {
    final TaskService runner = service(body: noopTaskBody);
    final String runId = await runner.start(
      cardId: 'move-v01',
      onEvent: (_) {},
    );
    await _waitFor(() => File('${tmp.path}/runs/$runId/run.json').existsSync());
    final bool finished = await _waitFor(() {
      final File file = File('${tmp.path}/runs/$runId/run.json');
      if (!file.existsSync()) return false;
      final Map<String, Object?> run =
          jsonDecode(file.readAsStringSync()) as Map<String, Object?>;
      return run['status'] == 'succeeded';
    });
    expect(finished, isTrue);
    final String status = await runner.cancel(runId);
    expect(status, 'succeeded');
    expect(File('${tmp.path}/runs/$runId/abort.request').existsSync(), isFalse);
  });

  test('手选工作区不拷贝示例 fixture', () async {
    final Directory fixture = Directory('$tasksDir/fixtures/organize/v01/inbox')
      ..createSync(recursive: true);
    File('${fixture.path}/sample.txt').writeAsStringSync('sample');
    final Directory other = Directory('${tmp.path}/other')..createSync();
    Directory('${other.path}/inbox').createSync();
    File('${other.path}/inbox/a.txt').writeAsStringSync('a');

    final TaskService runner = service(body: noopTaskBody);
    final String runId = await runner.start(
      cardId: 'move-v01',
      workspaceRoot: other.path,
      onEvent: (_) {},
    );
    expect(
      await _waitFor(
        () => File('${tmp.path}/runs/$runId/run.json').existsSync(),
      ),
      isTrue,
    );
    expect(
      await _waitFor(() {
        final File file = File('${tmp.path}/runs/$runId/run.json');
        if (!file.existsSync()) return false;
        final Map<String, Object?> run =
            jsonDecode(file.readAsStringSync()) as Map<String, Object?>;
        return run['status'] != 'running';
      }),
      isTrue,
    );
    expect(File('${other.path}/inbox/sample.txt').existsSync(), isFalse);
    expect(File('${other.path}/inbox/a.txt').existsSync(), isTrue);
  });

  test('send 在任务卡不可用时明确报错', () async {
    final TaskService runner = service(body: noopTaskBody);
    final String runId = await runner.start(
      cardId: 'move-v01',
      onEvent: (_) {},
    );
    await _waitFor(() => File('${tmp.path}/runs/$runId/run.json').existsSync());
    File('$tasksDir/move-v01.json').deleteSync();
    await expectLater(
      runner.send(runId, '继续', onEvent: (_) {}),
      throwsA(
        isA<BridgeError>().having(
          (BridgeError error) => error.code,
          'code',
          'INTERNAL',
        ),
      ),
    );
  });

  test('undo 后 send 仍能推送 fork 会话事件', () async {
    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    final TaskService runner = service(
      body: (RunScope scope, TaskSpec task) async {
        final String? text = scope.userText;
        if (text != null) {
          scope.session.append(
            'user/message',
            data: <String, Object?>{'text': text},
          );
        }
        return const TaskOutcome.ok();
      },
    );
    final String runId = await runner.start(
      cardId: 'move-v01',
      onEvent: events.add,
    );
    expect(
      await _waitFor(
        () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
      ),
      isTrue,
    );
    final RevertOutcome undone = await Runner(
      body: noopTaskBody,
      runsDir: '${tmp.path}/runs',
    ).undoOutcome(runId);
    expect(undone.ok, isTrue);
    events.clear();

    await runner.send(runId, '撤销后继续', onEvent: events.add);
    expect(
      await _waitFor(
        () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
      ),
      isTrue,
    );
    final List<String> texts = <String>[
      for (final Map<String, Object?> event in events)
        if (event['type'] == 'message/user')
          (event['data']! as Map<String, Object?>)['text']! as String,
    ];
    expect(texts, contains('撤销后继续'));
  });

  test('send 后立即 cancel 不会被续写清掉', () async {
    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    final TaskService runner = service(
      body: (RunScope scope, TaskSpec task) async {
        await Future<void>.delayed(const Duration(milliseconds: 400));
        return const TaskOutcome.ok();
      },
    );
    final String runId = await runner.start(
      cardId: 'move-v01',
      onEvent: events.add,
    );
    expect(
      await _waitFor(
        () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
      ),
      isTrue,
    );
    events.clear();

    await runner.send(runId, '继续', onEvent: events.add);
    await runner.cancel(runId);
    expect(
      await _waitFor(
        () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
      ),
      isTrue,
    );
    final Map<String, Object?> ended = events.last;
    expect((ended['data']! as Map<String, Object?>)['status'], 'aborted');
  });

  test('轮询间隔很长时收尾也会把最后一条消息读完', () async {
    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    final TaskService runner = TaskService(
      runsDir: '${tmp.path}/runs',
      tasksDir: tasksDir,
      pollInterval: const Duration(seconds: 5),
      env: <String, String>{
        'WORK_LLM_BASE_URL': 'http://x',
        'WORK_LLM_MODEL': 'm',
      },
      body: (RunScope scope, TaskSpec task) async {
        scope.session.append(
          'assistant/message',
          data: <String, Object?>{'text': '收尾'},
        );
        return const TaskOutcome.ok();
      },
    );
    await runner.start(cardId: 'move-v01', onEvent: events.add);
    final bool delivered = await _waitForWithin(
      () => events.any(
        (Map<String, Object?> e) => e['type'] == 'message/assistant/done',
      ),
      const Duration(seconds: 2),
    );
    expect(delivered, isTrue);
  });

  test('start 与 send 的事件 seq 在整个 run 内唯一', () async {
    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    final TaskService runner = service(
      body: (RunScope scope, TaskSpec task) async {
        final String? text = scope.userText;
        if (text != null) {
          scope.session.append(
            'user/message',
            data: <String, Object?>{'text': text},
          );
          scope.session.append(
            'assistant/message',
            data: <String, Object?>{'text': '收到'},
          );
        }
        return const TaskOutcome.ok();
      },
    );
    final String runId = await runner.start(
      cardId: 'move-v01',
      onEvent: events.add,
    );
    expect(
      await _waitFor(
        () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
      ),
      isTrue,
    );
    await runner.send(runId, '继续', onEvent: events.add);
    expect(
      await _waitFor(
        () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
      ),
      isTrue,
    );
    final List<String> keys = <String>[
      for (final Map<String, Object?> event in events)
        '${event['runId']}:${event['seq']}',
    ];
    expect(keys.toSet().length, keys.length, reason: 'UI 按 runId:seq 去重');
  });

  test('运行中实时推送产物与变更', () async {
    final String liveRoot = '${tmp.path}/live';
    Directory('$liveRoot/inbox').createSync(recursive: true);
    File('$liveRoot/inbox/a.txt').writeAsStringSync('a');
    final Map<String, Object?> card = cardJson(liveRoot)
      ..['id'] = 'live-v01'
      ..['expectedArtifacts'] = <String>['out/report.md'];
    File('$tasksDir/live-v01.json').writeAsStringSync(jsonEncode(card));

    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    int bodyReturnedAt = -1;
    final TaskService runner = TaskService(
      runsDir: '${tmp.path}/runs',
      tasksDir: tasksDir,
      pollInterval: const Duration(milliseconds: 20),
      env: <String, String>{
        'WORK_LLM_BASE_URL': 'http://x',
        'WORK_LLM_MODEL': 'm',
      },
      body: (RunScope scope, TaskSpec task) async {
        File('$liveRoot/out/report.md').writeAsStringSync('# 报告\n');
        File('$liveRoot/out/changes.json').writeAsStringSync(
          jsonEncode(<String, Object?>{
            'summary': <String, Object?>{'moved': 1, 'deleted': 0},
            'operations': <Object?>[
              <String, Object?>{
                'from': 'inbox/a.txt',
                'to': 'out/a.txt',
                'sha256': 'x',
                'reason': '测试',
              },
            ],
          }),
        );
        await Future<void>.delayed(const Duration(milliseconds: 120));
        bodyReturnedAt = events.length;
        return const TaskOutcome.ok();
      },
    );
    await runner.start(
      cardId: 'live-v01',
      workspaceRoot: liveRoot,
      onEvent: events.add,
    );
    expect(
      await _waitFor(
        () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
      ),
      isTrue,
    );
    final int artifactIndex = events.indexWhere(
      (Map<String, Object?> e) =>
          e['type'] == 'artifact/added' &&
          (e['data']! as Map<String, Object?>)['path'] == 'out/report.md',
    );
    final int changesIndex = events.indexWhere(
      (Map<String, Object?> e) => e['type'] == 'changes/updated',
    );
    expect(artifactIndex, isNonNegative);
    expect(changesIndex, isNonNegative);
    expect(artifactIndex, lessThan(bodyReturnedAt));
    expect(changesIndex, lessThan(bodyReturnedAt));
    expect(
      (events[artifactIndex]['seq']! as int),
      greaterThanOrEqualTo(1000000),
    );
    expect(
      (events[changesIndex]['seq']! as int),
      greaterThanOrEqualTo(1000000),
    );
  });

  test('cleanupWorkspaces 只保留最近 N 个', () async {
    final Directory base = Directory('${tmp.path}/ws')..createSync();
    final Directory oldest = Directory('${base.path}/a')..createSync();
    await Future<void>.delayed(const Duration(milliseconds: 20));
    final Directory middle = Directory('${base.path}/b')..createSync();
    await Future<void>.delayed(const Duration(milliseconds: 20));
    final Directory newest = Directory('${base.path}/c')..createSync();
    final TaskService runner = TaskService(
      runsDir: '${tmp.path}/runs',
      tasksDir: tasksDir,
      workspacesDir: base.path,
      env: <String, String>{},
    );
    await runner.cleanupWorkspaces(keep: 2, maxAge: Duration.zero);
    expect(oldest.existsSync(), isFalse);
    expect(middle.existsSync(), isTrue);
    expect(newest.existsSync(), isTrue);
  });

  test('cleanupWorkspaces 不删被 run.json 引用的工作区', () async {
    final Directory base = Directory('${tmp.path}/ws2')..createSync();
    final Directory referenced = Directory('${base.path}/keep')..createSync();
    final Directory spare = Directory('${base.path}/spare')..createSync();
    final Directory runs = Directory('${tmp.path}/runs2')..createSync();
    final Directory runDir = Directory('${runs.path}/run_x')..createSync();
    File('${runDir.path}/run.json').writeAsStringSync(
      jsonEncode(<String, Object?>{'workspaceRoot': referenced.path}),
    );
    final TaskService runner = TaskService(
      runsDir: runs.path,
      tasksDir: tasksDir,
      workspacesDir: base.path,
      env: <String, String>{},
    );
    await runner.cleanupWorkspaces(keep: 0, maxAge: Duration.zero);
    expect(referenced.existsSync(), isTrue);
    expect(spare.existsSync(), isFalse);
  });

  test('非法任务卡 id 被拒绝', () async {
    await expectLater(
      service().start(cardId: '../etc/passwd', onEvent: (_) {}),
      throwsA(isA<StateError>()),
    );
  });
}

Future<bool> _waitFor(bool Function() condition) async {
  final DateTime deadline = DateTime.now().add(const Duration(seconds: 10));
  while (DateTime.now().isBefore(deadline)) {
    if (condition()) return true;
    await Future<void>.delayed(const Duration(milliseconds: 50));
  }
  return condition();
}

Future<bool> _waitForWithin(bool Function() condition, Duration timeout) async {
  final DateTime deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    if (condition()) return true;
    await Future<void>.delayed(const Duration(milliseconds: 50));
  }
  return condition();
}
