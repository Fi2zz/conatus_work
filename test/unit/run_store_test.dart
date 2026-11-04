import 'dart:io';
import 'package:conatus_work/src/runner/hash.dart';
import 'package:conatus_work/src/runner/run_paths.dart';
import 'package:conatus_work/src/runner/run_store.dart';
import 'package:test/test.dart';

void main() {
  test('runId 形状稳定', () {
    expect(
      newRunId(DateTime(2026, 11, 2, 10, 15)),
      matches(RegExp(r'^run_20261102-101500-[0-9a-f]{4}$')),
    );
  });

  test('run.json 往返且写入原子', () async {
    final Directory tmp = Directory.systemTemp.createTempSync('run_store_');
    addTearDown(() => tmp.deleteSync(recursive: true));
    final RunPaths paths = RunPaths(
      runsDir: tmp.path,
      runId: 'run_20261102-101500-a1b2',
    );
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
    record.turnHistory = <TurnCheckpoint>[
      TurnCheckpoint(
        turn: 1,
        at: DateTime.parse('2026-11-02T10:16:00+08:00'),
        eventCount: 7,
      ),
    ];
    await store.save(record);
    final RunRecord loaded = await store.load();
    expect(loaded.taskId, 'research-v01');
    expect(loaded.chain, 'research');
    expect(loaded.startTurn, isNull);
    expect(loaded.turnHistory, hasLength(1));
    expect(loaded.turnHistory.single.turn, 1);
    expect(loaded.turnHistory.single.eventCount, 7);
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
    )..status = TaskRunStatus.succeeded;
    final RunRecord patched = applySnapshot(record, 'disk full');
    expect(patched.status, TaskRunStatus.succeeded);
    expect(patched.checkpointStatus, CheckpointStatus.error);
    expect(patched.checkpointError, 'disk full');
  });

  test('检查点失败在无业务失败时升级为 failed/checkpoint', () {
    final RunRecord record = RunRecord(
      runId: 'r',
      taskId: 't',
      chain: 'csv',
      taskPath: '/t.json',
      workspaceRoot: 'w',
      sessionId: 'events',
      pid: 1,
      startedAt: DateTime(2026, 11, 2),
    )..status = TaskRunStatus.succeeded;
    applySnapshot(record, 'disk full');
    applyCheckpointFailure(record, 'disk full');
    expect(record.status, TaskRunStatus.failed);
    expect(record.failure.category, FailureCategory.checkpoint);
    expect(record.failure.message, 'disk full');
  });

  test('aborted 不被检查点失败改写为 failed', () {
    final RunRecord record = RunRecord(
      runId: 'r',
      taskId: 't',
      chain: 'csv',
      taskPath: '/t.json',
      workspaceRoot: 'w',
      sessionId: 'events',
      pid: 1,
      startedAt: DateTime(2026, 11, 2),
    )..status = TaskRunStatus.aborted;
    applyCheckpointFailure(record, 'disk full');
    expect(record.status, TaskRunStatus.aborted);
    expect(record.failure.category, isNull);
  });

  test('已有业务失败不被检查点失败覆盖', () {
    final RunRecord record =
        RunRecord(
            runId: 'r',
            taskId: 't',
            chain: 'csv',
            taskPath: '/t.json',
            workspaceRoot: 'w',
            sessionId: 'events',
            pid: 1,
            startedAt: DateTime(2026, 11, 2),
          )
          ..status = TaskRunStatus.failed
          ..failure = RunFailure(
            category: FailureCategory.artifact,
            message: '产物缺失',
          );
    applySnapshot(record, 'disk full');
    applyCheckpointFailure(record, 'disk full');
    expect(record.status, TaskRunStatus.failed);
    expect(record.failure.category, FailureCategory.artifact);
  });

  test('时间戳带时区偏移', () async {
    final Directory tmp = Directory.systemTemp.createTempSync('run_store_tz_');
    addTearDown(() => tmp.deleteSync(recursive: true));
    final RunPaths paths = RunPaths(runsDir: tmp.path, runId: 'run_tz');
    await paths.create();
    await RunStore(paths).save(
      RunRecord(
        runId: 'run_tz',
        taskId: 't',
        chain: 'csv',
        taskPath: '/t.json',
        workspaceRoot: '/w',
        sessionId: 'events',
        pid: 1,
        startedAt: DateTime(2026, 11, 2, 10, 15),
      ),
    );
    final String raw = File(paths.runJsonPath).readAsStringSync();
    expect(
      raw,
      contains(
        RegExp(r'"startedAt": "2026-11-02T10:15:00[.0-9]*[+-]\d{2}:\d{2}"'),
      ),
    );
  });

  test('sha256 与已知向量一致', () {
    expect(
      sha256Hex(<int>[0x61, 0x62, 0x63]),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
}
