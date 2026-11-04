/// 默认执行体：把任务交给 Agent Loop，并在超时 / 超预算时判失败。
library;

import 'dart:async';

import 'package:conatus/conatus.dart';

import 'abort_signal.dart';
import 'assembly.dart';
import 'run_store.dart';
import 'task_body.dart';
import 'task_spec.dart';

/// 把确认状态写进用户回合：模型更可能跟随用户消息，而不是系统提示。
String _prompt(RunScope scope, TaskSpec task) => scope.confirmed
    ? '${task.prompt}\n\n【已确认】用户已在命令行用 --yes 批准执行，'
          '请直接完成全部操作并写出所有期望产物，不要再等待确认。'
    : '${task.prompt}\n\n【未确认】不要移动、删除或改动工作区内的已有文件；'
          '读取与在 out/ 写产物不受限制。';

TokenUsage _tokens(RunScope scope) => scope.usage?.total ?? TokenUsage.zero;

double? _cost(RunScope scope) => scope.rate?.costOf(_tokens(scope));

/// 成功路径：用量取计量器（含重试），预算按它判定。
TaskOutcome _outcome(RunScope scope, TaskSpec task) {
  final TokenUsage tokens = _tokens(scope);
  final double? cost = _cost(scope);
  if (cost != null && cost > task.maxCostUsd) {
    return TaskOutcome.failed(
      FailureCategory.budget,
      '成本 ${cost.toStringAsFixed(4)} USD 超过上限 ${task.maxCostUsd}',
      tokens: tokens,
      costUsd: cost,
    );
  }
  return TaskOutcome.ok(tokens: tokens, costUsd: cost);
}

/// 调用模型跑一轮；产物由运行器统一校验。
Future<TaskOutcome> agentTaskBody(RunScope scope, TaskSpec task) async {
  final AgentLoop? agent = scope.agent;
  if (agent == null) {
    return const TaskOutcome.failed(
      FailureCategory.llm,
      '未装配模型（缺少 LlmRuntime）',
    );
  }
  final AgentCancel cancel = AgentCancel();
  final int seconds = task.maxSeconds ?? task.maxMinutes * 60;
  final Timer timer = Timer(Duration(seconds: seconds), cancel.cancel);
  // 壳里点「停止」是写 abort.request；进程内运行要自己轮询，否则只能等跑完。
  final AbortSignal signal = AbortSignal(scope.paths.abortFlagPath);
  final Timer heartbeat = Timer.periodic(const Duration(milliseconds: 120), (
    Timer _,
  ) {
    if (signal.requested) cancel.cancel();
  });
  try {
    final String prompt = scope.userText ?? _prompt(scope, task);
    await agent.run(prompt, cancel: cancel);
    return _outcome(scope, task);
  } on AgentCancelled {
    if (signal.requested) {
      return TaskOutcome.aborted(tokens: _tokens(scope), costUsd: _cost(scope));
    }
    return TaskOutcome.failed(
      FailureCategory.timeout,
      '超过任务时长上限',
      tokens: _tokens(scope),
      costUsd: _cost(scope),
    );
  } catch (error) {
    return TaskOutcome.failed(
      FailureCategory.llm,
      '$error',
      tokens: _tokens(scope),
      costUsd: _cost(scope),
    );
  } finally {
    timer.cancel();
    heartbeat.cancel();
  }
}
