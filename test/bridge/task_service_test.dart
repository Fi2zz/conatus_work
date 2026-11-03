import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:conatus/conatus.dart';
import 'package:conatus_work/src/bridge/task_service.dart';
import 'package:conatus_work/src/runner/assembly.dart';
import 'package:conatus_work/src/runner/runner.dart';
import 'package:conatus_work/src/runner/task_spec.dart';
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
    Directory('$tasksDir/fixtures/organize/v01/inbox').createSync(recursive: true);
    File('$tasksDir/fixtures/organize/v01/inbox/a.txt').writeAsStringSync('a');

    final List<Map<String, Object?>> events = <Map<String, Object?>>[];
    final TaskService runner = TaskService(
      runsDir: '${tmp.path}/runs',
      tasksDir: tasksDir,
      workspacesDir: '${tmp.path}/ws',
      pollInterval: const Duration(milliseconds: 20),
      env: <String, String>{'WORK_LLM_BASE_URL': 'http://x', 'WORK_LLM_MODEL': 'm'},
      body: (RunScope scope, TaskSpec task) async => const TaskOutcome.ok(),
    );
    final String runId = await runner.start(cardId: 'move-v01', onEvent: events.add);
    final bool finished = await _waitFor(
      () => events.any((Map<String, Object?> e) => e['type'] == 'task/ended'),
    );
    expect(finished, isTrue);
    final File record = File('${tmp.path}/runs/$runId/run.json');
    expect(record.existsSync(), isTrue, reason: '最后一条事件：${events.isEmpty ? '无' : events.last}');
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
      env: <String, String>{'WORK_LLM_BASE_URL': 'http://x', 'WORK_LLM_MODEL': 'm'},
      clientFactory: () => client,
      body: (RunScope scope, TaskSpec task) async {
        await Future<void>.delayed(const Duration(milliseconds: 500));
        return const TaskOutcome.ok();
      },
    );
    final String runId = await runner.start(cardId: 'move-v01', onEvent: (_) {});
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
