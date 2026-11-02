/// 一次运行的实际执行：装配、执行体、产物判定、检查点收口。
library;

import 'abort_signal.dart';
import 'artifacts.dart';
import 'assembly.dart';
import 'run_paths.dart';
import 'run_store.dart';
import 'task_body.dart';
import 'task_spec.dart';
import 'workspace.dart';

/// 一次运行的执行状态；把参数收进对象，避免函数参数超限。
class RunExecution {
  RunExecution({
    required this.body,
    required this.record,
    required this.task,
    required this.workspace,
    required this.paths,
    required this.store,
  });

  final TaskBody body;
  final RunRecord record;
  final TaskSpec task;
  final WorkspacePlan workspace;
  final RunPaths paths;
  final RunStore store;

  Future<RunRecord> execute() async {
    RunScope? scope;
    try {
      scope = await assembleRun(task: task, workspace: workspace, paths: paths);
      _attach(scope);
      await store.save(record);
      final TaskOutcome outcome = await _runBody(scope);
      _apply(outcome);
      if (record.status == RunStatus.succeeded) await _checkArtifacts();
      await _snapshot(scope);
    } catch (error) {
      record
        ..status = RunStatus.failed
        ..failure = RunFailure(
          category: FailureCategory.internal,
          message: '$error',
        );
      if (scope != null) await _snapshot(scope);
    } finally {
      record.endedAt = DateTime.now();
      await store.save(record);
      await scope?.dispose();
    }
    return record;
  }

  void _attach(RunScope scope) {
    record
      ..startTurn = scope.checkpoint.turn
      ..sessionId = scope.session.id
      ..tools = scope.toolNames;
  }

  Future<TaskOutcome> _runBody(RunScope scope) async {
    final AbortSignal signal = AbortSignal(paths.abortFlagPath);
    if (signal.requested) return const TaskOutcome.aborted();
    final TaskOutcome outcome = await body(scope, task);
    return signal.requested ? const TaskOutcome.aborted() : outcome;
  }

  void _apply(TaskOutcome outcome) {
    switch (outcome.status) {
      case RunStatus.aborted:
        record.status = RunStatus.aborted;
      case RunStatus.failed:
        record
          ..status = RunStatus.failed
          ..failure = RunFailure(
            category: outcome.category ?? FailureCategory.internal,
            message: outcome.message,
          );
      case RunStatus.running:
      case RunStatus.succeeded:
        record.status = RunStatus.succeeded;
    }
  }

  Future<void> _checkArtifacts() async {
    final List<ArtifactCheck> checks = await checkArtifacts(
      root: workspace.rootAbsolute,
      expected: task.expectedArtifacts,
    );
    record.artifacts = checks;
    if (checks.every((ArtifactCheck check) => check.passed)) return;
    record
      ..status = RunStatus.failed
      ..failure = RunFailure(
        category: FailureCategory.artifact,
        message: '期望产物未通过检查',
      );
  }

  Future<void> _snapshot(RunScope scope) async {
    final String? error = await scope.checkpoint
        .recordTurn(lastEventId: scope.session.lastEventId);
    applySnapshot(record, error);
    record.endTurn = scope.checkpoint.turn;
  }
}
