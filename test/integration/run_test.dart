import 'dart:io';
import 'package:conatus_work/src/runner/abort_signal.dart';
import 'package:conatus_work/src/runner/assembly.dart';
import 'package:conatus_work/src/runner/run_paths.dart';
import 'package:conatus_work/src/runner/run_store.dart';
import 'package:conatus_work/src/runner/runner.dart';
import 'package:conatus_work/src/runner/task_spec.dart';
import 'package:conatus_work/src/runner/workspace.dart';
import 'package:test/test.dart';

TaskSpec card({List<String> artifacts = const <String>[]}) =>
    TaskSpec.parse(<String, Object?>{
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
      'expectedArtifacts': artifacts,
      'acceptance': <String>[],
      'limits': <String, Object?>{'maxMinutes': 1, 'maxCostUsd': 0.1},
      'checkpoint': <String, Object?>{'enabled': true, 'keep': 30},
    });

void main() {
  late Directory tmp;
  setUp(() => tmp = Directory.systemTemp.createTempSync('run_'));
  tearDown(() => tmp.deleteSync(recursive: true));

  test('空任务卡跑通，turns 0→1', () async {
    final Runner runner = Runner(
      body: noopTaskBody,
      runsDir: '${tmp.path}/runs',
    );
    final RunRecord record = await runner.run(
      card(),
      taskPath: '${tmp.path}/empty.json',
      workspaceRoot: '${tmp.path}/work',
    );
    expect(record.status, TaskRunStatus.succeeded);
    expect(record.startTurn, 0);
    expect(record.endTurn, 1);
    expect(record.checkpointStatus, CheckpointStatus.ok);
    final RunRecord loaded = await RunStore(
      RunPaths(runsDir: '${tmp.path}/runs', runId: record.runId),
    ).load();
    expect(loaded.status, TaskRunStatus.succeeded);
  });

  test('期望产物缺失 → failed/artifact', () async {
    final Runner runner = Runner(
      body: noopTaskBody,
      runsDir: '${tmp.path}/runs',
    );
    final RunRecord record = await runner.run(
      card(artifacts: <String>['out/report.md']),
      taskPath: '${tmp.path}/empty.json',
      workspaceRoot: '${tmp.path}/work',
    );
    expect(record.status, TaskRunStatus.failed);
    expect(record.failure.category, FailureCategory.artifact);
  });

  test('abort.request 在执行体结束后生效 → aborted', () async {
    final Runner runner = Runner(
      runsDir: '${tmp.path}/runs',
      body: (RunScope scope, TaskSpec task) async {
        await AbortSignal(scope.paths.abortFlagPath).request();
        return const TaskOutcome.ok();
      },
    );
    final RunRecord record = await runner.run(
      card(),
      taskPath: '${tmp.path}/empty.json',
      workspaceRoot: '${tmp.path}/work',
    );
    expect(record.status, TaskRunStatus.aborted);
  });

  test('输入缺失在预检阶段失败，且不产生运行目录', () async {
    final Runner runner = Runner(
      body: noopTaskBody,
      runsDir: '${tmp.path}/runs',
    );
    final TaskSpec withInput = TaskSpec.parse(<String, Object?>{
      'id': 'missing-input',
      'chain': 'research',
      'title': '缺输入',
      'workspace': <String, Object?>{
        'root': 'work2',
        'read': <String>['inbox'],
        'write': <String>['out'],
      },
      'inputs': <String>['inbox/brief.md'],
      'prompt': '空跑',
      'network': 'deny',
      'expectedArtifacts': <String>[],
      'acceptance': <String>[],
      'limits': <String, Object?>{'maxMinutes': 1, 'maxCostUsd': 0.1},
      'checkpoint': <String, Object?>{'enabled': true, 'keep': 30},
    });
    await expectLater(
      runner.run(
        withInput,
        taskPath: '${tmp.path}/card.json',
        workspaceRoot: '${tmp.path}/work2',
      ),
      throwsA(isA<RunPreflightError>()),
    );
    expect(Directory('${tmp.path}/runs').existsSync(), isFalse);
  });
}
