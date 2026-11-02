/// `run` 的编排入口：分配运行目录、记录起点、交给执行体。
library;

import 'dart:convert';
import 'dart:io';

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
    final RunPaths paths =
        RunPaths(runsDir: runsDir, runId: newRunId(DateTime.now()));
    await paths.create();
    final WorkspacePlan workspace =
        await prepareWorkspace(task: task, rootOverride: workspaceRoot);
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
    )..rerunOf =
        rerunOf ?? await _previousRun(task.id, workspace.rootAbsolute);
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
