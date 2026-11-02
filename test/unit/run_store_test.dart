import 'dart:io';
import 'package:conatus_work/src/runner/hash.dart';
import 'package:conatus_work/src/runner/run_paths.dart';
import 'package:conatus_work/src/runner/run_store.dart';
import 'package:test/test.dart';

void main() {
  test('runId 形状稳定', () {
    expect(newRunId(DateTime(2026, 11, 2, 10, 15)),
        matches(RegExp(r'^run_20261102-101500-[0-9a-f]{4}$')));
  });

  test('run.json 往返且写入原子', () async {
    final Directory tmp = Directory.systemTemp.createTempSync('run_store_');
    addTearDown(() => tmp.deleteSync(recursive: true));
    final RunPaths paths =
        RunPaths(runsDir: tmp.path, runId: 'run_20261102-101500-a1b2');
    await paths.create();
    final RunStore store = RunStore(paths);
    final RunRecord record = RunRecord(
      runId: paths.runId,
      taskId: 'research-v01',
      chain: 'research',
      taskPath: '/tmp/tasks/research-v01.json',
      workspaceRoot: 'var/workspaces/r1',
      sessionId: 'events',
      pid: 42,
      startedAt: DateTime.parse('2026-11-02T10:15:00+08:00'),
    );
    await store.save(record);
    final RunRecord loaded = await store.load();
    expect(loaded.taskId, 'research-v01');
    expect(loaded.chain, 'research');
    expect(loaded.startTurn, isNull);
    expect(File('${paths.runJsonPath}.tmp').existsSync(), isFalse);
  });

  test('快照失败只改检查点状态', () async {
    final RunRecord record = RunRecord(
      runId: 'r',
      taskId: 't',
      chain: 'csv',
      taskPath: '/t.json',
      workspaceRoot: 'w',
      sessionId: 'events',
      pid: 1,
      startedAt: DateTime(2026, 11, 2),
    )..status = RunStatus.succeeded;
    final RunRecord patched = applySnapshot(record, 'disk full');
    expect(patched.status, RunStatus.succeeded);
    expect(patched.checkpointStatus, CheckpointStatus.error);
    expect(patched.checkpointError, 'disk full');
  });

  test('sha256 与已知向量一致', () {
    expect(sha256Hex(<int>[0x61, 0x62, 0x63]),
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
}
