/// `run` 的编排入口：分配运行目录、记录起点、交给执行体。
library;

import 'dart:convert';
import 'dart:io';

import 'package:conatus/conatus.dart';

import 'abort_signal.dart';
import 'run_execution.dart';
import 'run_paths.dart';
import 'run_store.dart';
import 'task_body.dart';
import 'task_spec.dart';
import 'workspace.dart';

export 'task_body.dart' show TaskBody, TaskOutcome, noopTaskBody;

/// 串行运行器：一次一个任务，一任务一轮检查点。
class Runner {
  Runner({required this.body, this.runsDir = 'var/runs'});

  /// 任务执行体。
  final TaskBody body;

  /// `var/runs` 的位置。
  final String runsDir;

  /// 跑一张任务卡，返回落盘后的运行记录。
  Future<RunRecord> run(
    TaskSpec task, {
    required String taskPath,
    String? workspaceRoot,
    String? rerunOf,
  }) async {
    await preflightRun(task, rootOverride: workspaceRoot);
    final WorkspacePlan workspace = await prepareWorkspace(
      task: task,
      rootOverride: workspaceRoot,
    );
    final RunPaths paths = RunPaths(
      runsDir: runsDir,
      runId: newRunId(DateTime.now()),
    );
    await paths.create();
    final RunStore store = RunStore(paths);
    final RunRecord record = RunRecord(
      runId: paths.runId,
      taskId: task.id,
      chain: task.chain,
      taskPath: File(taskPath).absolute.path,
      workspaceRoot: workspace.rootAbsolute,
      sessionId: 'events',
      pid: pid,
      startedAt: DateTime.now(),
    )..rerunOf = rerunOf ?? await _previousRun(task.id, workspace.rootAbsolute);
    await store.save(record);
    return RunExecution(
      body: body,
      record: record,
      task: task,
      workspace: workspace,
      paths: paths,
      store: store,
    ).execute();
  }

  /// 恢复一次未完成的运行：接回同一会话与检查点时间线。
  Future<RunRecord> resume(String runId) async {
    final RunPaths paths = RunPaths(runsDir: runsDir, runId: runId);
    final RunStore store = RunStore(paths);
    final RunRecord record = await store.load();
    final TaskSpec task = await TaskSpec.load(record.taskPath);
    final WorkspacePlan workspace = await prepareWorkspace(
      task: task,
      rootOverride: record.workspaceRoot,
    );
    await AbortSignal(paths.abortFlagPath).clear();
    record
      ..status = TaskRunStatus.running
      ..pid = pid
      ..resumeCount += 1
      ..endedAt = null;
    await store.save(record);
    return RunExecution(
      body: body,
      record: record,
      task: task,
      workspace: workspace,
      paths: paths,
      store: store,
      fresh: false,
    ).execute();
  }

  /// 请求中断；进程已死时当场收口并标 `aborted`。
  Future<RunRecord> abort(String runId) async {
    final RunPaths paths = RunPaths(runsDir: runsDir, runId: runId);
    final RunStore store = RunStore(paths);
    final RunRecord record = await store.load();
    if (pidAlive(record.pid)) {
      await AbortSignal(paths.abortFlagPath).request();
      return record;
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
    await checkpoint.bind(record.sessionId);
    await checkpoint.flush();
    applySnapshot(record, await checkpoint.recordTurn());
    record
      ..status = TaskRunStatus.aborted
      ..endTurn = checkpoint.turn
      ..endedAt = DateTime.now();
    await store.save(record);
    return record;
  }

  /// 找同一任务卡 + 同一工作区的上一次运行，用于记 `rerunOf`。
  Future<String?> _previousRun(String taskId, String workspaceRoot) async {
    final Directory dir = Directory(runsDir);
    if (!dir.existsSync()) return null;
    String? found;
    DateTime? latest;
    for (final FileSystemEntity entity in dir.listSync()) {
      final RunRecord? other = _tryLoad(entity.path);
      if (!_sameTask(other, taskId, workspaceRoot)) continue;
      if (!_isLatest(other!, latest)) continue;
      latest = other.startedAt;
      found = other.runId;
    }
    return found;
  }
}

RunRecord? _tryLoad(String runDir) {
  final File file = File('$runDir${Platform.pathSeparator}run.json');
  if (!file.existsSync()) return null;
  try {
    final Object? json = jsonDecode(file.readAsStringSync());
    return json is Map<String, Object?> ? RunRecord.fromJson(json) : null;
  } catch (_) {
    return null;
  }
}

bool _sameTask(RunRecord? other, String taskId, String workspaceRoot) {
  if (other == null) return false;
  return other.taskId == taskId && other.workspaceRoot == workspaceRoot;
}

bool _isLatest(RunRecord other, DateTime? latest) =>
    latest == null || other.startedAt.isAfter(latest);
