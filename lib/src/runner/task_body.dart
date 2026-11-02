/// 任务执行体的契约：运行器只认「拿到范围、返回结局」这一个形状。
library;

import 'assembly.dart';
import 'run_store.dart';
import 'task_spec.dart';

/// 执行体的结局。
class TaskOutcome {
  const TaskOutcome.ok()
    : status = TaskRunStatus.succeeded,
      category = null,
      message = null;

  const TaskOutcome.failed(this.category, this.message)
    : status = TaskRunStatus.failed;

  const TaskOutcome.aborted()
    : status = TaskRunStatus.aborted,
      category = null,
      message = null;

  /// 结局状态。
  final TaskRunStatus status;

  /// 失败分类（仅 failed 有意义）。
  final FailureCategory? category;

  /// 失败说明。
  final String? message;
}

/// 任务执行体：拿到装配好的运行范围，返回结局。
typedef TaskBody = Future<TaskOutcome> Function(RunScope scope, TaskSpec task);

/// 第 1 周的默认执行体：什么都不做，只验证装配与收口。
Future<TaskOutcome> noopTaskBody(RunScope scope, TaskSpec task) async =>
    const TaskOutcome.ok();
