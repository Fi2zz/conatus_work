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

extension RunnerUndo on Runner {
  /// 撤销一次运行：把工作区恢复到任务开始前那一轮，并记下撤销点供 `redo` 使用。
  Future<RunRecord> undo(String runId, {int? steps}) async {
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
    await checkpoint.bind(record.sessionId);
    await checkpoint.flush();
    final int available = checkpoint.turn - (record.startTurn ?? 0);
    if (available < 1) {
      throw StateError('没有可撤销的轮次（当前第 ${checkpoint.turn} 轮）');
    }
    final SessionStore sessions = SessionStore(
      persistence: JsonlSessionPersistence(dir: paths.runDir),
    );
    final Session session = await sessions.open(record.sessionId);
    final UndoResult result = await RevertService(
      checkpoint: checkpoint,
      sessions: sessions,
    ).undo(session, steps ?? available);
    record.forkSessionId = result.stage.forkSessionId;
    await RevertStageStore(paths).save(result.stage);
    await store.save(record);
    return record;
  }

  /// 重做上次撤销：把工作区恢复到撤销前的轮次，并清除撤销点。
  Future<RunRecord> redo(String runId) async {
    final RunPaths paths = RunPaths(runsDir: runsDir, runId: runId);
    final RunStore store = RunStore(paths);
    final RunRecord record = await store.load();
    final RevertStageStore stages = RevertStageStore(paths);
    final RevertStage? stage = stages.load();
    if (stage == null) {
      throw StateError('没有可重做的撤销：$runId');
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
    await RevertService(checkpoint: checkpoint, sessions: sessions).redo(stage);
    await stages.clear();
    record.forkSessionId = null;
    await store.save(record);
    return record;
  }
}
