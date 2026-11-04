import 'dart:convert';
import 'dart:io';

import 'package:conatus/conatus.dart';
import 'package:conatus_work/src/runner/assembly.dart';
import 'package:conatus_work/src/runner/checkpoint_budget.dart';
import 'package:conatus_work/src/runner/run_paths.dart';
import 'package:conatus_work/src/runner/run_store.dart';
import 'package:conatus_work/src/runner/runner.dart';
import 'package:conatus_work/src/runner/task_spec.dart';
import 'package:conatus_work/src/runner/workspace.dart';
import 'package:test/test.dart';

Map<String, Object?> cardJson() => <String, Object?>{
  'id': 'budget-v01',
  'chain': 'organize',
  'title': '预算',
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
  late TaskSpec task;

  setUp(() {
    tmp = Directory.systemTemp.createTempSync('budget_');
    cardPath = '${tmp.path}/card.json';
    File(cardPath).writeAsStringSync(jsonEncode(cardJson()));
    task = TaskSpec.parse(cardJson());
  });

  tearDown(() => tmp.deleteSync(recursive: true));

  test('超预算时收紧 keep 并裁掉最旧差量', () async {
    final Runner runner = Runner(
      runsDir: '${tmp.path}/runs',
      body: (RunScope scope, TaskSpec task) async => const TaskOutcome.ok(),
    );
    final RunRecord first = await runner.run(
      RunRequest(
        task: task,
        taskPath: cardPath,
        workspaceRoot: '${tmp.path}/work',
      ),
    );
    await runner.continueRun(first.runId, '第二轮');
    final RunRecord last = await runner.continueRun(first.runId, '第三轮');
    final RunPaths paths = RunPaths(
      runsDir: runner.runsDir,
      runId: first.runId,
    );

    final CheckpointStore store = await openCheckpointStore(
      options: CheckpointOptions(
        keep: 30,
        policy: productCheckpointPolicy(),
      ),
      root: last.workspaceRoot,
      projectDir: paths.runDir,
    );
    expect(store.list(last.sessionId).length, greaterThan(2));
    expect(
      directorySizeBytes(Directory('${paths.runDir}/checkpoints')),
      greaterThan(0),
    );

    final int keep = await enforceCheckpointBudget(
      task: task,
      root: last.workspaceRoot,
      projectDir: paths.runDir,
      sessionId: last.sessionId,
      budgetBytes: 1,
    );
    expect(keep, 2);
    expect(store.list(last.sessionId), hasLength(2));
  });
}
