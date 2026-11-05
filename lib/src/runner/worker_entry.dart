/// worker 进程入口：读作业文件，跑一次 run / continue，写 run.json 与事件。
library;

import 'dart:io';

import 'agent_task_body.dart';
import 'file_approval.dart';
import 'llm_config.dart';
import 'llm_runtime.dart';
import 'run_paths.dart';
import 'run_store.dart';
import 'runner.dart';
import 'task_spec.dart';
import 'worker_job.dart';

/// 执行一个 worker 作业；参数是作业文件路径。
Future<int> runWorkerJob(List<String> args) async {
  if (args.isEmpty) return 2;
  final WorkerJob job;
  try {
    job = WorkerJob.read(args.first);
  } on Object {
    return 2;
  }
  final TaskSpec task;
  try {
    task = await TaskSpec.load(job.cardPath);
  } on Object {
    return 2;
  }
  LlmRuntime? runtime;
  try {
    runtime = LlmRuntime(config: llmConfigFromEnv(Platform.environment));
  } on LlmConfigError {
    runtime = null;
  }
  final RunPaths paths = RunPaths(runsDir: job.runsDir, runId: job.runId);
  final FileApproval approval = FileApproval(runDir: paths.runDir);
  final Runner runner = Runner(
    body: agentTaskBody,
    runsDir: job.runsDir,
    llm: runtime,
    checkpointBudgetBytes: job.budgetBytes,
  );
  try {
    final RunRecord record;
    if (job.mode == 'continue') {
      record = await runner.continueRun(
        job.runId,
        job.text ?? '',
        approval: approval,
      );
    } else {
      record = await runner.run(
        RunRequest(
          task: task,
          taskPath: job.cardPath,
          workspaceRoot: job.workspaceRoot,
          fixtureDir: job.fixtureDir,
          confirmed: job.confirmed,
        ),
        runId: job.runId,
        approval: approval,
      );
    }
    return record.status == TaskRunStatus.succeeded ? 0 : 1;
  } on Object {
    return 1;
  } finally {
    await approval.close();
  }
}
