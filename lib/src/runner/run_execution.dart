/// 一次运行的实际执行：装配、执行体、产物判定、检查点收口。
library;

import 'package:conatus/conatus.dart';

import 'abort_signal.dart';
import 'artifacts.dart';
import 'assembly.dart';
import 'llm_runtime.dart';
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
    this.fresh = true,
    this.llm,
    this.confirmed = false,
    this.sessionId,
    this.userText,
    this.accumulateUsage = false,
    this.onStream,
    this.approval,
  });

  final TaskBody body;
  final RunRecord record;
  final TaskSpec task;
  final WorkspacePlan workspace;
  final RunPaths paths;
  final RunStore store;

  /// true 重建检查点时间线（新运行）；false 接管已有时间线（resume / continue）。
  final bool fresh;

  /// 模型运行时；为空时不装配 Agent Loop。
  final LlmRuntime? llm;

  /// 用户是否已确认执行。
  final bool confirmed;

  /// 接管的会话 id；空表示 `events`。
  final String? sessionId;

  /// 续写时替代任务卡 prompt 的用户文本。
  final String? userText;

  /// 是否在已有用量上继续累加（resume / continue）。
  final bool accumulateUsage;

  /// 模型流式增量出口。
  final void Function(LlmStreamEvent event)? onStream;

  /// 工具审批端口；空表示不启用。
  final Approval? approval;

  Future<RunRecord> execute() async {
    RunScope? scope;
    try {
      scope = await assembleRun(
        AssemblyOptions(
          task: task,
          workspace: workspace,
          paths: paths,
          fresh: fresh,
          llm: llm,
          confirmed: confirmed,
          sessionId: sessionId,
          userText: userText,
          onStream: onStream,
          approval: approval,
        ),
      );
      _attach(scope);
      await store.save(record);
      final TaskOutcome outcome = await _runBody(scope);
      _apply(outcome);
      final int priorInput = accumulateUsage ? record.inputTokens : 0;
      final int priorOutput = accumulateUsage ? record.outputTokens : 0;
      final double priorCost = accumulateUsage ? record.costUsd : 0;
      record
        ..inputTokens = priorInput + outcome.tokens.prompt
        ..outputTokens = priorOutput + outcome.tokens.completion
        ..costUsd = priorCost + (outcome.costUsd ?? 0);
      if (record.status == TaskRunStatus.succeeded) await _checkArtifacts();
      await _snapshot(scope);
    } catch (error) {
      record
        ..status = TaskRunStatus.failed
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
      ..sessionId = scope.session.id
      ..tools = scope.toolNames
      ..model = scope.modelLabel;
    if (fresh) record.startTurn = scope.checkpoint.turn;
  }

  Future<TaskOutcome> _runBody(RunScope scope) async {
    final AbortSignal signal = AbortSignal(paths.abortFlagPath);
    if (signal.requested) return const TaskOutcome.aborted();
    final TaskOutcome outcome = await body(scope, task);
    return signal.requested ? const TaskOutcome.aborted() : outcome;
  }

  void _apply(TaskOutcome outcome) {
    switch (outcome.status) {
      case TaskRunStatus.aborted:
        record
          ..status = TaskRunStatus.aborted
          ..failure = RunFailure();
      case TaskRunStatus.failed:
        record
          ..status = TaskRunStatus.failed
          ..failure = RunFailure(
            category: outcome.category ?? FailureCategory.internal,
            message: outcome.message,
          );
      case TaskRunStatus.running:
      case TaskRunStatus.succeeded:
        record
          ..status = TaskRunStatus.succeeded
          ..failure = RunFailure();
    }
  }

  Future<void> _checkArtifacts() async {
    final List<ArtifactCheck> checks = await checkArtifacts(
      root: workspace.rootAbsolute,
      expected: task.expectedArtifacts,
      rules: task.artifactRules,
    );
    record.artifacts = checks;
    if (checks.every((ArtifactCheck check) => check.passed)) return;
    record
      ..status = TaskRunStatus.failed
      ..failure = RunFailure(
        category: FailureCategory.artifact,
        message: '期望产物未通过检查',
      );
  }

  Future<void> _snapshot(RunScope scope) async {
    final String? turnError = await scope.checkpoint.recordTurn(
      lastEventId: scope.session.lastEventId,
    );
    applySnapshot(record, scope.baselineError ?? turnError);
    record.endTurn = scope.checkpoint.turn;
    record.turnHistory.add(
      TurnCheckpoint(
        turn: scope.checkpoint.turn,
        at: DateTime.now(),
        eventCount: scope.session.events.length,
      ),
    );
  }
}
