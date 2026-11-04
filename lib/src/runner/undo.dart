/// `undo` / `redo`：用检查点把工作区恢复，并把撤销点落盘。
library;

import 'package:conatus/conatus.dart';
import 'package:conatus_checkpoint/revert.dart';

import 'revert_stage_store.dart';
import 'run_paths.dart';
import 'run_store.dart';
import 'runner.dart';
import 'task_spec.dart';
import 'workspace.dart';

/// 一条撤销失败；UI 按文件展示。
class UndoFailure {
  const UndoFailure(this.path, this.error);

  /// 失败路径；整体失败时用「工作区」。
  final String path;

  /// 人可读原因。
  final String error;

  Map<String, Object?> toJson() => <String, Object?>{
    'path': path,
    'error': error,
  };
}

/// 一次撤销 / 重做的结果。
class RevertOutcome {
  const RevertOutcome({
    required this.record,
    required this.ok,
    required this.appliedSteps,
    this.failures = const <UndoFailure>[],
    this.code,
  });

  /// 运行记录（失败时保持原样）。
  final RunRecord record;

  /// 是否成功。
  final bool ok;

  /// 实际回退 / 恢复的轮数。
  final int appliedSteps;

  /// 失败明细；成功时为空。
  final List<UndoFailure> failures;

  /// 错误码：`PRUNED` / `STALE_TURN` / `NOT_FOUND` / `INTERNAL`。
  final String? code;

  Map<String, Object?> toJson() => <String, Object?>{
    'ok': ok,
    'appliedSteps': appliedSteps,
    'failures': <Object?>[
      for (final UndoFailure failure in failures) failure.toJson(),
    ],
    if (code != null) 'code': code,
  };
}

extension RunnerUndo on Runner {
  /// 撤销一次运行；失败时抛异常（保留给 CLI / 测试）。
  Future<RunRecord> undo(String runId, {int? steps}) async {
    final RevertOutcome outcome = await undoOutcome(runId, steps: steps);
    if (!outcome.ok) throw RevertException(outcome.failures.first.error);
    return outcome.record;
  }

  /// 撤销一次运行，并把实际步数与失败明细返回给桥接层。
  Future<RevertOutcome> undoOutcome(String runId, {int? steps}) async {
    final RunPaths paths = RunPaths(runsDir: runsDir, runId: runId);
    final RunStore store = RunStore(paths);
    final RunRecord record = await store.load();
    final TaskSpec task = await TaskSpec.load(record.taskPath);
    final CheckpointOptions options = CheckpointOptions(
      enabled: task.checkpointEnabled,
      keep: task.checkpointKeep,
      policy: productCheckpointPolicy(),
    );
    final CheckpointManager checkpoint = CheckpointManager(
      store: await openCheckpointStore(
        options: options,
        root: record.workspaceRoot,
        projectDir: paths.runDir,
      ),
      options: options,
    );
    await checkpoint.bind(record.forkSessionId ?? record.sessionId);
    await checkpoint.flush();
    final int available = checkpoint.turn - (record.startTurn ?? 0);
    if (available < 1) {
      return _persistUndoFailure(
        store,
        record,
        '没有可撤销的轮次（当前第 ${checkpoint.turn} 轮）',
        'STALE_TURN',
      );
    }
    final SessionStore sessions = SessionStore(
      persistence: JsonlSessionPersistence(dir: paths.runDir),
    );
    final Session session = await sessions.open(
      record.forkSessionId ?? record.sessionId,
    );
    try {
      final UndoResult result = await RevertService(
        checkpoint: checkpoint,
        sessions: sessions,
      ).undo(session, steps ?? available);
      record.forkSessionId = result.stage.forkSessionId;
      record.endTurn = result.stage.toTurn;
      record.turnHistory.removeWhere(
        (TurnCheckpoint turn) => turn.turn > result.stage.toTurn,
      );
      record.undoCount += 1;
      await RevertStageStore(paths).save(result.stage);
      await store.save(record);
      return RevertOutcome(
        record: record,
        ok: true,
        appliedSteps: _steps(result.stage.fromTurn, result.stage.toTurn),
      );
    } on RevertException catch (error) {
      return _persistUndoFailure(
        store,
        record,
        error.message,
        _codeOf(error.message),
      );
    } on Object catch (error) {
      return _persistUndoFailure(store, record, '$error', 'INTERNAL');
    }
  }

  /// 重做上次撤销；失败时抛异常（保留给 CLI / 测试）。
  Future<RunRecord> redo(String runId) async {
    final RevertOutcome outcome = await redoOutcome(runId);
    if (!outcome.ok) throw StateError(outcome.failures.first.error);
    return outcome.record;
  }

  /// 重做上次撤销，并返回实际恢复的轮数。
  Future<RevertOutcome> redoOutcome(String runId) async {
    final RunPaths paths = RunPaths(runsDir: runsDir, runId: runId);
    final RunStore store = RunStore(paths);
    final RunRecord record = await store.load();
    final RevertStageStore stages = RevertStageStore(paths);
    final RevertStage? stage = stages.load();
    if (stage == null) {
      return _failure(record, '没有可重做的撤销：$runId', 'NOT_FOUND');
    }
    final TaskSpec task = await TaskSpec.load(record.taskPath);
    final CheckpointOptions options = CheckpointOptions(
      enabled: task.checkpointEnabled,
      keep: task.checkpointKeep,
      policy: productCheckpointPolicy(),
    );
    final CheckpointManager checkpoint = CheckpointManager(
      store: await openCheckpointStore(
        options: options,
        root: record.workspaceRoot,
        projectDir: paths.runDir,
      ),
      options: options,
    );
    await checkpoint.bind(stage.originalSessionId);
    await checkpoint.flush();
    final SessionStore sessions = SessionStore(
      persistence: JsonlSessionPersistence(dir: paths.runDir),
    );
    try {
      await RevertService(
        checkpoint: checkpoint,
        sessions: sessions,
      ).redo(stage);
      await stages.clear();
      record.forkSessionId = null;
      record.sessionId = stage.originalSessionId;
      record.endTurn = stage.fromTurn;
      record.turnHistory.add(
        TurnCheckpoint(
          turn: stage.fromTurn,
          at: DateTime.now(),
          eventCount: record.turnHistory.isEmpty
              ? 0
              : record.turnHistory.last.eventCount,
        ),
      );
      record.redoCount += 1;
      await store.save(record);
      return RevertOutcome(
        record: record,
        ok: true,
        appliedSteps: _steps(stage.fromTurn, stage.toTurn),
      );
    } on RevertException catch (error) {
      return _failure(record, error.message, _codeOf(error.message));
    } on Object catch (error) {
      return _failure(record, '$error', 'INTERNAL');
    }
  }
}

Future<RevertOutcome> _persistUndoFailure(
  RunStore store,
  RunRecord record,
  String message,
  String code,
) async {
  record.undoFailureCount += 1;
  await store.save(record);
  return _failure(record, message, code);
}

RevertOutcome _failure(RunRecord record, String message, String code) =>
    RevertOutcome(
      record: record,
      ok: false,
      appliedSteps: 0,
      failures: <UndoFailure>[UndoFailure('工作区', message)],
      code: code,
    );

int _steps(int from, int to) {
  final int steps = from - to;
  return steps < 0 ? 0 : steps;
}

String _codeOf(String message) {
  if (message.contains('裁剪')) return 'PRUNED';
  if (message.contains('没有可撤销') || message.contains('轮次')) {
    return 'STALE_TURN';
  }
  return 'INTERNAL';
}
