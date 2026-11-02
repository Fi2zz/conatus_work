import 'dart:convert';
import 'dart:io';
import 'package:conatus_work/src/runner/run_paths.dart';
import 'package:conatus_work/src/runner/run_store.dart';
import 'package:conatus_work/src/runner/runner.dart';
import 'package:conatus_work/src/runner/task_spec.dart';
import 'package:test/test.dart';

Map<String, Object?> cardJson() => <String, Object?>{
      'id': 'empty-v01',
      'chain': 'research',
      'title': '空任务',
      'workspace': <String, Object?>{
        'root': 'work',
        'read': <String>[],
        'write': <String>['out'],
      },
      'inputs': <String>[],
      'prompt': '空跑',
      'network': 'deny',
      'expectedArtifacts': <String>[],
      'acceptance': <String>[],
      'limits': <String, Object?>{'maxMinutes': 1, 'maxCostUsd': 0.1},
      'checkpoint': <String, Object?>{'enabled': true, 'keep': 30},
    };

void main() {
  late Directory tmp;
  late String cardPath;
  setUp(() {
    tmp = Directory.systemTemp.createTempSync('resume_');
    cardPath = '${tmp.path}/card.json';
    File(cardPath).writeAsStringSync(jsonEncode(cardJson()));
  });
  tearDown(() => tmp.deleteSync(recursive: true));

  test('执行体抛异常后 resume 续到下一轮', () async {
    bool first = true;
    final Runner runner = Runner(
      runsDir: '${tmp.path}/runs',
      body: (scope, task) async {
        if (first) {
          first = false;
          throw StateError('boom');
        }
        return const TaskOutcome.ok();
      },
    );
    final RunRecord firstRun = await runner.run(TaskSpec.parse(cardJson()),
        taskPath: cardPath, workspaceRoot: '${tmp.path}/work');
    expect(firstRun.status, RunStatus.failed);
    expect(firstRun.failure.category, FailureCategory.internal);
    final RunRecord resumed = await runner.resume(firstRun.runId);
    expect(resumed.status, RunStatus.succeeded);
    expect(resumed.startTurn, 1);
    expect(resumed.endTurn, 2);
    expect(resumed.resumeCount, 1);
  });

  test('abort 一个已死进程的 run：标 aborted 且收口', () async {
    final Runner runner = Runner(
        body: noopTaskBody, runsDir: '${tmp.path}/runs');
    final RunRecord record = await runner.run(TaskSpec.parse(cardJson()),
        taskPath: cardPath, workspaceRoot: '${tmp.path}/work');
    final RunStore store =
        RunStore(RunPaths(runsDir: runner.runsDir, runId: record.runId));
    final RunRecord dead = await store.load()
      ..status = RunStatus.running
      ..pid = 999999
      ..endedAt = null;
    await store.save(dead);
    final RunRecord aborted = await runner.abort(record.runId);
    expect(aborted.status, RunStatus.aborted);
    expect(aborted.checkpointStatus, CheckpointStatus.ok);
  });
}
