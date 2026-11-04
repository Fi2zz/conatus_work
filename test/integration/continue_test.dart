import 'dart:convert';
import 'dart:io';

import 'package:conatus/conatus.dart';
import 'package:conatus_work/src/bridge/projection.dart';
import 'package:conatus_work/src/runner/assembly.dart';
import 'package:conatus_work/src/runner/run_paths.dart';
import 'package:conatus_work/src/runner/run_store.dart';
import 'package:conatus_work/src/runner/runner.dart';
import 'package:conatus_work/src/runner/task_spec.dart';
import 'package:conatus_work/src/runner/undo.dart';
import 'package:test/test.dart';

Map<String, Object?> cardJson() => <String, Object?>{
  'id': 'continue-v01',
  'chain': 'research',
  'title': '续写任务',
  'workspace': <String, Object?>{
    'root': 'work',
    'read': <String>[],
    'write': <String>['out'],
  },
  'inputs': <String>[],
  'prompt': '先做一半',
  'network': 'deny',
  'expectedArtifacts': <String>[],
  'acceptance': <String>[],
  'limits': <String, Object?>{'maxMinutes': 1, 'maxCostUsd': 1},
  'checkpoint': <String, Object?>{'enabled': true, 'keep': 30},
};

void main() {
  late Directory tmp;
  late String cardPath;

  setUp(() {
    tmp = Directory.systemTemp.createTempSync('continue_');
    cardPath = '${tmp.path}/card.json';
    File(cardPath).writeAsStringSync(jsonEncode(cardJson()));
  });

  tearDown(() => tmp.deleteSync(recursive: true));

  test('continueRun 追加轮次、保留任务起点并累计用量', () async {
    int calls = 0;
    String? userText;
    final Runner runner = Runner(
      runsDir: '${tmp.path}/runs',
      body: (RunScope scope, TaskSpec task) async {
        calls += 1;
        userText = scope.userText;
        return TaskOutcome.ok(
          tokens: TokenUsage(prompt: calls * 10, completion: calls * 5),
          costUsd: calls / 100,
        );
      },
    );
    final RunRecord first = await runner.run(
      RunRequest(
        task: TaskSpec.parse(cardJson()),
        taskPath: cardPath,
        workspaceRoot: '${tmp.path}/work',
      ),
    );
    final RunRecord second = await runner.continueRun(first.runId, '继续做');

    expect(second.status, TaskRunStatus.succeeded);
    expect(second.startTurn, 0);
    expect(second.endTurn, 2);
    expect(second.turnHistory, hasLength(2));
    expect(second.inputTokens, 30);
    expect(second.outputTokens, 15);
    expect(second.costUsd, closeTo(0.03, 0.000001));
    expect(userText, '继续做');
  });

  test('continueRun 使用 forkSessionId 指向的会话', () async {
    String? sessionId;
    final Runner runner = Runner(
      runsDir: '${tmp.path}/runs',
      body: (RunScope scope, TaskSpec task) async {
        sessionId = scope.session.id;
        return const TaskOutcome.ok();
      },
    );
    final RunRecord first = await runner.run(
      RunRequest(
        task: TaskSpec.parse(cardJson()),
        taskPath: cardPath,
        workspaceRoot: '${tmp.path}/work',
      ),
    );
    final RunStore store = RunStore(
      RunPaths(runsDir: runner.runsDir, runId: first.runId),
    );
    final RunRecord saved = await store.load()
      ..forkSessionId = 'events-fork';
    await store.save(saved);

    await runner.continueRun(first.runId, '继续');

    expect(sessionId, 'events-fork');
  });

  test('undo 后 continueRun 的事件写进 fork 会话并可被投影', () async {
    final Runner runner = Runner(
      runsDir: '${tmp.path}/runs',
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
    final RunRecord first = await runner.run(
      RunRequest(
        task: TaskSpec.parse(cardJson()),
        taskPath: cardPath,
        workspaceRoot: '${tmp.path}/work',
      ),
    );
    final RevertOutcome undone = await runner.undoOutcome(first.runId);
    expect(undone.ok, isTrue);
    await runner.continueRun(first.runId, '撤销后继续');

    final RunPaths paths = RunPaths(
      runsDir: runner.runsDir,
      runId: first.runId,
    );
    final RunFixture fixture = projectRunDir(paths.runDir);
    final List<String> texts = <String>[
      for (final Map<String, Object?> event in fixture.events)
        if (event['type'] == 'message/user')
          (event['data']! as Map<String, Object?>)['text']! as String,
    ];
    expect(texts, contains('撤销后继续'));
  });
}
