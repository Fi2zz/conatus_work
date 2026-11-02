import 'package:conatus_work/src/runner/report.dart';
import 'package:conatus_work/src/runner/run_store.dart';
import 'package:test/test.dart';

RunRecord rec(String chain, RunStatus status, {bool edited = false}) =>
    RunRecord(
      runId: 'r',
      taskId: 't',
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
                  at: DateTime(2026, 11, 2), artifact: 'out/a.md', note: 'n')
            ]
          : <HumanEdit>[];

void main() {
  test('按链统计成功、失败与救场率', () {
    final String text = renderReport(<RunRecord>[
      rec('research', RunStatus.succeeded),
      rec('research', RunStatus.succeeded, edited: true),
      rec('csv', RunStatus.failed),
    ]);
    expect(text, contains('research'));
    expect(text, contains('2/2'));
    expect(text, contains('50.0%'));
    expect(text, contains('csv'));
  });
}
