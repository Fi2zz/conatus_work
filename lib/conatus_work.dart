/// conatus_work —— 基于 conatus 的产品层。
///
/// 分工：conatus 提供可逆效应 + 反应式共效应的运行时、LLM 接入、工具系统与
/// Agent Loop；本包只做产品装配与场景逻辑。
///
/// 产品层边界：不进入 conatus 的伞包 re-export，也不被其它库 import。随功能
/// 落地，装配入口放 `lib/src/`，单文件单职责（沿用 conatus 仓库的约束）。
library;

export 'src/bridge/bridge.dart' show WorkbenchBridge;
export 'src/bridge/config_store.dart'
    show ConfigStore, WorkbenchConfig, mergeEnv, parseEnvFile, validateConfig;
export 'src/bridge/contract.dart' show RunFixture, RunSummary;
export 'src/bridge/host.dart' show BridgeHost, kProtocolVersion;
export 'src/bridge/projection.dart' show projectRunDir;
export 'src/bridge/task_service.dart' show TaskCard, TaskService;
export 'src/bridge/worker_launcher.dart'
    show ProcessWorker, WorkerLauncher, WorkerProcess;
export 'src/runner/assembly.dart' show RunScope;
export 'src/runner/cli.dart' show kRunsDir, runCli;
export 'src/runner/run_store.dart'
    show
        ArtifactCheck,
        CheckpointStatus,
        FailureCategory,
        HumanEdit,
        RunFailure,
        RunRecord,
        TaskRunStatus,
        RunStore,
        applySnapshot;
export 'src/runner/runner.dart'
    show Runner, TaskBody, TaskOutcome, noopTaskBody;
export 'src/runner/task_spec.dart' show TaskSpec, TaskSpecError, kTaskChains;
export 'src/runner/worker_entry.dart' show runWorkerJob;
export 'src/runner/worker_job.dart' show WorkerJob;
