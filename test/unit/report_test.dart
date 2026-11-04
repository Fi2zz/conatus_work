import 'package:conatus_work/src/runner/report.dart';
import 'package:conatus_work/src/runner/run_store.dart';
import 'package:test/test.dart';

RunRecord rec(
  String chain,
  TaskRunStatus status, {
  bool edited = false,
  String task = 't',
}) =>
    RunRecord(
        runId: 'r',
        taskId: task,
        chain: chain,
        taskPath: '/t.json',
        workspaceRoot: 'w',
        sessionId: 'events',
        pid: 1,
        startedAt: DateTime(2026, 11, 2),
      )
      ..status = status
      ..humanEdits = edited
          ? <HumanEdit>[
              HumanEdit(
                at: DateTime(2026, 11, 2),
                artifact: 'out/a.md',
                note: 'n',
              ),
            ]
          : <HumanEdit>[];

void main() {
  test('按链统计成功、失败与救场率', () {
    final String text = renderReport(<RunRecord>[
      rec('research', TaskRunStatus.succeeded, task: 'a'),
      rec('research', TaskRunStatus.succeeded, edited: true, task: 'b'),
      rec('csv', TaskRunStatus.failed, task: 'c'),
    ]);
    expect(text, contains('research'));
    expect(text, contains('2/2'));
    expect(text, contains('50.0%'));
    expect(text, contains('csv'));
  });

  test('同一任务多次尝试只算一次，取最近一次并记为救场', () {
    final RunRecord first = rec('research', TaskRunStatus.failed)
      ..taskId = 'task-a'
      ..startedAt = DateTime(2026, 11, 2, 10);
    final RunRecord retry = rec('research', TaskRunStatus.succeeded)
      ..taskId = 'task-a'
      ..startedAt = DateTime(2026, 11, 2, 11)
      ..rerunOf = 'run-first';
    final String text = renderReport(<RunRecord>[first, retry]);
    expect(text, contains('total=1'));
    expect(text, contains('succeeded=1/1'));
    expect(text, contains('rescued=1'));
  });

  test('每行带 P50/P95，末尾带失败分类与救场构成', () {
    final RunRecord a = rec('research', TaskRunStatus.succeeded, task: 'a')
      ..startedAt = DateTime(2026, 11, 2, 10)
      ..endedAt = DateTime(2026, 11, 2, 10, 4)
      ..inputTokens = 1200
      ..outputTokens = 300
      ..costUsd = 0.012
      ..undoCount = 1
      ..undoFailureCount = 0
      ..undoDamage = 1
      ..redoCount = 1;
    final RunRecord b = rec('research', TaskRunStatus.failed, task: 'b')
      ..startedAt = DateTime(2026, 11, 2, 11)
      ..endedAt = DateTime(2026, 11, 2, 11, 8)
      ..failure = RunFailure(category: FailureCategory.artifact);
    final String text = renderReport(<RunRecord>[a, b]);
    expect(text, contains('p50=4.0min'));
    expect(text, contains('p95=8.0min'));
    expect(text, contains('failures=artifact:1'));
    expect(text, contains('rescuedBy=rerun:0,human:0'));
    expect(text, contains('tokensIn=1200'));
    expect(text, contains('tokensOut=300'));
    expect(text, contains('costUsd=0.0120'));
    expect(text, contains('undo=ok:1,failed:0,damage:1,redo:1,redoFailed:0'));
  });
}
