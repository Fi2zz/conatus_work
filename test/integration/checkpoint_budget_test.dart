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

  setUp(() {
    tmp = Directory.systemTemp.createTempSync('budget_');
    cardPath = '${tmp.path}/card.json';
    File(cardPath).writeAsStringSync(jsonEncode(cardJson()));
  });

  tearDown(() => tmp.deleteSync(recursive: true));

  Future<RunRecord> runThreeTurns({int? budgetBytes}) async {
    final Runner runner = Runner(
      runsDir: '${tmp.path}/runs',
      checkpointBudgetBytes: budgetBytes,
      body: (RunScope scope, TaskSpec task) async => const TaskOutcome.ok(),
    );
    final RunRecord first = await runner.run(
      RunRequest(
        task: TaskSpec.parse(cardJson()),
        taskPath: cardPath,
        workspaceRoot: '${tmp.path}/work',
      ),
    );
    await runner.continueRun(first.runId, '第二轮');
    return runner.continueRun(first.runId, '第三轮');
  }

  Future<List<int>> turnsOf(RunRecord record) async {
    final CheckpointStore store = await openCheckpointStore(
      options: CheckpointOptions(keep: 30, policy: productCheckpointPolicy()),
      root: record.workspaceRoot,
      projectDir: RunPaths(
        runsDir: '${tmp.path}/runs',
        runId: record.runId,
      ).runDir,
    );
    return <int>[
      for (final CheckpointInfo info in store.list(record.sessionId)) info.turn,
    ];
  }

  test('预算充足时不裁剪历史', () async {
    final RunRecord record = await runThreeTurns();
    expect(await turnsOf(record), hasLength(4));
    expect(record.checkpointKeep, 30);
  });

  test('直接清理会回收磁盘字节', () async {
    final RunRecord record = await runThreeTurns();
    final Directory checkpoints = Directory(
      '${RunPaths(runsDir: '${tmp.path}/runs', runId: record.runId).runDir}'
      '/checkpoints',
    );
    final int before = directorySizeBytes(checkpoints);
    final int keep = await enforceCheckpointBudget(
      BudgetRequest(
        task: TaskSpec.parse(cardJson()),
        root: record.workspaceRoot,
        projectDir: RunPaths(
          runsDir: '${tmp.path}/runs',
          runId: record.runId,
        ).runDir,
        sessionId: record.sessionId,
        budgetBytes: 1,
      ),
    );
    expect(keep, 2);
    expect(directorySizeBytes(checkpoints), lessThan(before));
    expect(await turnsOf(record), hasLength(2));
  });

  test('超预算时收紧 keep 并实际回收字节', () async {
    final RunRecord record = await runThreeTurns(budgetBytes: 1);
    final Directory checkpoints = Directory(
      '${RunPaths(runsDir: '${tmp.path}/runs', runId: record.runId).runDir}'
      '/checkpoints',
    );
    expect(directorySizeBytes(checkpoints), greaterThan(0));
    expect(await turnsOf(record), hasLength(2));
    expect(record.checkpointKeep, 2);
  });
}
