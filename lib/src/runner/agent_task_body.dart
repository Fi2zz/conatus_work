/// 默认执行体：把任务交给 Agent Loop，并在超时 / 超预算时判失败。
library;

import 'dart:async';

import 'package:conatus/conatus.dart';

import 'assembly.dart';
import 'run_store.dart';
import 'task_body.dart';
import 'task_spec.dart';

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
  final Timer timer = Timer(Duration(minutes: task.maxMinutes), cancel.cancel);
  try {
    final AgentTurn turn = await agent.run(task.prompt, cancel: cancel);
    final double? cost = turn.cost;
    if (cost != null && cost > task.maxCostUsd) {
      return TaskOutcome.failed(
        FailureCategory.budget,
        '成本 ${cost.toStringAsFixed(4)} USD 超过上限 ${task.maxCostUsd}',
        tokens: turn.tokens,
        costUsd: cost,
      );
    }
    return TaskOutcome.ok(tokens: turn.tokens, costUsd: cost);
  } on AgentCancelled {
    return const TaskOutcome.failed(FailureCategory.timeout, '超过任务时长上限');
  } catch (error) {
    return TaskOutcome.failed(FailureCategory.llm, '$error');
  } finally {
    timer.cancel();
  }
}
