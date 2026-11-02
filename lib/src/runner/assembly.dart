/// 运行器装配：把 fs / 工具 / 会话 / 检查点装进一棵 Context。
///
/// Context 只活在本文件里；出口是普通对象 [RunScope]，其余模块不依赖框架。
library;

import 'package:conatus/conatus.dart';

import '../tools/mkdir.dart';
import '../tools/move.dart';
import '../tools/rooted_fs.dart';
import 'llm_runtime.dart';
import 'run_paths.dart';
import 'task_spec.dart';
import 'workspace.dart';

/// 遍历时跳过的目录：通用依赖目录 + 产品自己的数据目录。
const Set<String> _skipDirs = <String>{...kDefaultSkipDirs, '.conatus_work'};

/// `assembleRun` 的全部输入。
class AssemblyOptions {
  const AssemblyOptions({
    required this.task,
    required this.workspace,
    required this.paths,
    this.fresh = true,
    this.llm,
  });

  /// 任务卡。
  final TaskSpec task;

  /// 工作区边界。
  final WorkspacePlan workspace;

  /// 运行目录。
  final RunPaths paths;

  /// true 重建检查点时间线，false 接管已有时间线。
  final bool fresh;

  /// 模型运行时；为空时只装配文件工具（第 1 周的空跑）。
  final LlmRuntime? llm;
}

/// 一次运行持有的框架对象。
class RunScope {
  RunScope({
    required this.ctx,
    required this.fs,
    required this.checkpoint,
    required this.sessionStore,
    required this.session,
    required this.paths,
    required this.toolNames,
    this.baselineError,
    this.agent,
    this.modelLabel,
  });

  /// 本次运行的上下文树。
  final Context ctx;

  /// 带读写边界的文件系统。
  final RootedFileSystem fs;

  /// 检查点管理器。
  final CheckpointManager checkpoint;

  /// 会话仓库。
  final SessionStore sessionStore;

  /// 本次运行的主会话（id 固定 `events`）。
  final Session session;

  /// 运行目录布局。
  final RunPaths paths;

  /// 已注册工具名。
  final List<String> toolNames;

  /// turn 0 基线快照的错误（成功为 null）。
  final String? baselineError;

  /// 装配好的 Agent Loop；没有模型时为 null。
  final AgentLoop? agent;

  /// 写进 `run.json.model` 的标签。
  final String? modelLabel;

  /// 关闭会话并释放整棵上下文。
  Future<void> dispose() async {
    sessionStore.close(session.id);
    ctx.dispose();
  }
}

/// 装配一次运行。[fresh] 为 true 时重建检查点时间线，false 时接管已有时间线。
Future<RunScope> assembleRun(AssemblyOptions options) async {
  final TaskSpec task = options.task;
  final WorkspacePlan workspace = options.workspace;
  final RunPaths paths = options.paths;
  final bool fresh = options.fresh;
  final Context ctx = Context.root();
  final RootedFileSystem fs = RootedFileSystem(
    inner: LocalFileSystem(cwd: workspace.rootAbsolute),
    root: workspace.rootAbsolute,
    readPrefixes: workspace.readPrefixes,
    writePrefixes: workspace.writePrefixes,
  );
  provideFileSystemLocal(ctx, fs: fs);
  provideTools(ctx);
  provideFsTools(
    ctx,
    options: const FsToolOptions(enablePatch: true, skipDirs: _skipDirs),
  );
  ctx.tools.register(MkdirTool(fs: fs));
  ctx.tools.register(MoveTool(fs: fs));
  if (task.allowNetwork) {
    provideSearch(ctx);
    provideWebTools(ctx);
  }

  final SessionStore sessionStore = provideSessions(
    ctx,
    sessions: SessionStore(
      persistence: JsonlSessionPersistence(dir: paths.runDir),
    ),
  );
  final Session session = await sessionStore.open('events');

  final CheckpointOptions checkpointOptions = CheckpointOptions(
    enabled: task.checkpointEnabled,
    keep: task.checkpointKeep,
    policy: productCheckpointPolicy(),
  );
  final CheckpointManager checkpoint = CheckpointManager(
    store: await openCheckpointStore(
      options: checkpointOptions,
      root: workspace.rootAbsolute,
      projectDir: paths.runDir,
    ),
    options: checkpointOptions,
  );
  final String? baselineError = await (fresh
      ? checkpoint.reset('events')
      : checkpoint.bind('events'));
  await checkpoint.flush();
  ctx.provide('checkpointManager', checkpoint);
  final bool hasLlm = _provideModel(ctx, options.llm, task, workspace);
  final AgentLoop? agent = hasLlm
      ? provideAgentLoop(ctx, session: session, maxSteps: 40)
      : null;

  return RunScope(
    ctx: ctx,
    fs: fs,
    checkpoint: checkpoint,
    sessionStore: sessionStore,
    session: session,
    paths: paths,
    toolNames: ctx.tools.names,
    baselineError: baselineError,
    agent: agent,
    modelLabel: options.llm?.modelLabel,
  );
}

/// 装好模型与系统提示；返回是否装了模型。
bool _provideModel(
  Context ctx,
  LlmRuntime? llm,
  TaskSpec task,
  WorkspacePlan workspace,
) {
  if (llm == null) return false;
  provideLlm(ctx, llm: FallbackLlm(<LlmProvider>[llm.provider]));
  final ModelRate? rate = llm.rate;
  if (rate != null) ctx.provide('modelRate', rate);
  provideSystemPrompt(ctx, prompt: productSystemPrompt(task, workspace));
  return true;
}
