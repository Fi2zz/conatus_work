# 阶段 0 第 1 周：运行器骨架设计

- 日期：2026-11-02
- 状态：设计定稿，未写实现代码
- 上游文档（唯一事实来源，冲突时以上游为准）：
  1. `2026-10-30-desktop-workbench-feasibility.md`（决策稿）
  2. `2026-10-30-phase0-task-chains-and-runner.md`（执行稿）
- 本文件只补第 1 周的实现级设计：模块边界、写边界语义、运行生命周期、测试与验收。
  任务链内容、产物格式、指标口径仍按执行稿。

## 一、目标与范围

第 1 周的终点是一句话：**一张空任务卡能跑通，并写出合法的 `run.json`。**

包含：

- 任务卡模型与校验、run store、工作区准备、Context 装配、`run` / `resume` / `abort` /
  `list` / `report` / `edit` 六个子命令；
- allow-list 写边界 `RootedFileSystem`，以及 `move` / `mkdir` 两个工具；
- 第 1 周不接 Agent Loop、不调模型、不装 shell、不联网。

不包含：三条链的 fixtures、产物校验的进阶规则（字数 / 标题 / SVG 可解析）、
`RevertService` 接线、UI、常驻服务。这些按执行稿第九节排在第 2 周及以后。

## 二、本次定案（对话结论）

| 议题 | 结论 |
|---|---|
| 模型与凭据 | OpenAI 兼容 provider；baseUrl / model / apiKey 全从环境变量读（`WORK_LLM_BASE_URL` / `WORK_LLM_MODEL` / `WORK_LLM_API_KEY`）。第 1 周只留 `LlmFactory` 注入点，不实现调用、不读变量。 |
| 读边界 | **读写都按白名单**：根内只有 `read ∪ write` 可读，根外全拒。`workspace.read` 因此是硬边界，不再只是登记字段。 |
| `move` / `mkdir` | 作为 `RootedFileSystem` 的两个额外方法（不进 `FileSystem` 抽象），工具显式接收该实例；内部用 `Directory.create` / `File.rename`。 |
| 按链汇总 | 任务卡增 `chain` 字段，写进 `run.json`；`report` 只读 `run.json`，不依赖任务卡目录。 |
| fixtures | 每条链先手写 1 份打样，人工抽查后再脚本变体化到 `v01..v10`（第 2 周执行）。 |
| 第 1 周依赖 | 只新增 `crypto: ^3.0.0`（`sha256`）。`CheckpointManager` 走伞包导出，暂不加 `conatus_checkpoint` 直接依赖。 |

## 三、模块结构

**框架边界**：Conatus 的 `Context` 只活在 `assembly.dart` 内。其余模块是普通 Dart 对象，
不 `require` 服务，可脱离上下文单测。运行器对外返回结构化结果，不靠打印文本判断成功。

```dart
// assembly.dart 的出口
class RunScope {
  final Context ctx;
  final RootedFileSystem fs;
  final CheckpointManager checkpoint;
  final SessionStore sessionStore;
  final Session session;
  Future<void> dispose(); // ctx.dispose() + sessionStore.close(session.id)
}
```

| 文件 | 职责 | 行数预算 |
|---|---|---|
| `bin/runner.dart` | 参数解析、调库、打印摘要；手写解析，不引 `args` | 120 |
| `lib/src/runner/task_spec.dart` | `TaskSpec` 模型 + 解析 + 校验 | 150 |
| `lib/src/runner/run_paths.dart` | `runId` 生成与 `var/runs/<id>/` 布局 | 60 |
| `lib/src/runner/run_store.dart` | `RunRecord` / `ArtifactCheck` / `RunFailure` 与 `run.json` 读写 | 180 |
| `lib/src/runner/workspace.dart` | 根归一化、建目录、`CheckpointPolicy` | 80 |
| `lib/src/runner/assembly.dart` | Context + fs + tools + checkpoint + session → `RunScope` | 140 |
| `lib/src/runner/runner.dart` | `run` / `resume` / `abort` 编排与轮次边界 | 180 |
| `lib/src/runner/artifacts.dart` | `expectedArtifacts` 校验 + `sha256` | 90 |
| `lib/src/runner/abort_signal.dart` | pid + `abort.request` 标志文件 | 50 |
| `lib/src/runner/report.dart` | 读 `run.json` 出汇总 | 90 |
| `lib/src/tools/rooted_fs.dart` | allow-list `FileSystem` 装饰器 + `mkdir` / `move` | 150 |
| `lib/src/tools/move.dart` / `mkdir.dart` | 两个工具，显式接收 `RootedFileSystem` | 70 / 60 |

沿用父仓硬约束：单文件 ≤ 200 行、函数参数 ≤ 4、`if/else/switch` 合计 ≤ 3、
布尔变量不用 `is/has/can/should` 前缀。

**第 1 周不装 shell。** `bash -c` 会绕过 `RootedFileSystem`，与「没有越权写入」这条
验收直接冲突。需要 shell 的场景（链 3 的文件操作）已由 `move` / `mkdir` 覆盖。

## 四、写边界语义（`RootedFileSystem`）

判定只用规范路径，不用字面路径。

```
rootReal   = realPathViaAncestor(root)             // /var/… → /private/var/…
prefixReal = realPathViaAncestor(rootReal + '/' + prefix)
```

| 操作 | 网关 |
|---|---|
| `resolve` / `contains` / `processPath` / `fileUrl` | 透传（不做内容访问） |
| `stat` / `lstat` / `listDir` / `readText` / `readBytes` | 落在 `rootReal` 且落在 `read ∪ write` 的某个 `prefixReal` 下 |
| `writeText` / `editText` / `mkdir` / `move` 的目标 | 落在 `rootReal` 且落在 `write` 的某个 `prefixReal` 下 |
| `remove` | 同写入网关，另加：目标不得等于根、也不得是根的祖先 |
| `move` 的源 | 同时满足「可读」与「可写」——移动 = 删除源 |

细则：

- 符号链接逃逸由 `targetKey` 天然挡住：`out/link → /etc` 时写 `out/link/passwd`
  的 `targetKey` 是 `/etc/passwd`，不在 `rootReal` 下，直接拒。
- 不做双拼写比较。`ReadOnlyPathGuard` 同时比字面与规范路径，是因为它的威胁方向是
  「保护目录里的链接指向外部」；allow-list 方向相反，规范路径单判即可，还避免
  `/var` 与 `/private/var` 互比产生的假拒绝。
- 段级比较、macOS / Windows 小写比较，直接复用 `conatus_foundation` 已导出的
  `underReadOnlyRoot` / `normalizeReadOnlyPath` / `realPathViaAncestor`。
- 拒绝统一抛 `FsError(FsErrorCode.sandboxDenied, …)`，消息含尝试的路径与允许前缀，
  不含宿主根的绝对真实路径。
- 根本身允许 `stat` / `listDir`（否则顶层都看不到），不允许 `writeText`。

两个额外方法：

```dart
Future<void> mkdir(String path);                 // 递归创建；已是目录则幂等成功
Future<MoveResult> move(String from, String to); // 目标已存在则失败，不覆盖
```

`mkdir` 必须过网关：`Directory.create(recursive: true)` 会沿路径建树，不校验就能建到根外。

`move` 用 `File.rename` / `Directory.rename`（同卷原子），不做跨设备降级——阶段 0
工作区都在本地同一卷，明确报错优于留下半个副本。冲突文件进 `quarantine/` 由 agent
自己决定（对应链 3 验收项）。

## 五、运行生命周期

### 5.1 `run` 的顺序

1. 解析并校验任务卡（纯函数）。
2. 预检，不落盘：root 可创建、`inputs` 存在、`write` 前缀合法、`keep ≥ 1`。
3. 分配 `runId = run_<yyyyMMdd-HHmmss>-<4hex>`，建 `var/runs/<runId>/`。
4. 先写一次 `run.json`（`status: running`、`pid`、`startedAt`、`chain`、`taskPath`、
   `tools`），进程被杀也留痕。`taskPath` 存绝对路径，供 `resume` / `abort` 重读任务卡
   拿提示词与检查点选项。
5. 装配：`SessionStore(JsonlSessionPersistence(dir: runDir))` 以会话 id `events`
   建会话，正好落成 `events.jsonl`；`openCheckpointStore(root: workspaceRoot,
   projectDir: runDir)`。
6. 新运行 `reset('events')` 写 turn 0 基线 → `flush()` → `startTurn = checkpoint.turn`。
7. 执行体（第 1 周空实现，注入点 `TaskBody`）。
8. 产物校验 → `ArtifactCheck[]`。
9. 收口 `snapshotError = await recordTurn(lastEventId: session.lastEventId)`，
   `endTurn = checkpoint.turn`。
10. 原子写最终 `run.json`。

**状态与检查点失败分开**：`snapshotError` 不改任务 `status`，只写
`checkpoint: {status: error, error: …}`。快照失败是「撤不了」，不是「任务没做完」，
混在一起会让 80% 门槛的统计失真。

### 5.2 `resume` 与 `abort`

| 命令 | 行为 |
|---|---|
| `resume <run-id>` | 读 `run.json` → `open('events')` → `checkpoint.bind('events')` + `flush()` → `startTurn = 当前 turn`，更新 `turns.start` 与 `pid` → 重跑执行体 → 再 `recordTurn`；`run.json.resumeCount` +1，不记 `rerunOf` |
| `abort <run-id>` | pid 存活：写 `abort.request`，运行器在下一个检查点（第 1 周为执行体结束后）收口并标 `aborted`；pid 已死：用 `run.json.taskPath` 重读任务卡取检查点选项，当场 `bind` + `recordTurn` + 标 `aborted` |

`abort` 必须跨进程可见，否则「中断与恢复能正确工作」无法演示。第 1 周只做标志文件 +
pid 存活判断，不做信号量与 Kill。

## 六、CLI

```bash
dart run bin/runner.dart list
dart run bin/runner.dart run   tasks/<card>.json --workspace var/workspaces/<id> [--fixture <dir>] [--rerun-of <runId>]
dart run bin/runner.dart resume <runId>
dart run bin/runner.dart abort  <runId>
dart run bin/runner.dart report var/runs
dart run bin/runner.dart edit   <runId> --artifact out/report.md --note "手动改了结论段"
```

- 相对路径一律相对当前工作目录解析；CLI 不做 chdir。
- `--workspace` 是**工作区根**，直接覆盖任务卡的 `workspace.root`；不传时用任务卡的值。
- `--fixture` 第 2 周实现：把 fixture 树拷进工作区，已存在则拒绝覆盖。
- `rerunOf` 自动识别：同一 `taskId` + 同一 `workspace.root` 已有记录时自动填，
  `--rerun-of` 可覆盖。
- `report` 输出：按 chain 的总数、成功、失败、救场率（`humanEdits` 非空或
  `rerunOf` 非空）、失败分类分布、产物一次通过率。P50 / P95 等有真实耗时数据再补。
- `edit` 追加 `humanEdits`，同时记该文件当时的 `sha256`。

## 七、数据结构

### 7.1 任务卡

执行稿 3.2 的字段，加一个 `chain`：

```json
{
  "id": "research-cited-report-v01",
  "chain": "research",
  "title": "调研 macOS 本地优先 AI 工作台并生成带引用报告",
  "workspace": { "root": "var/workspaces/research-001", "read": ["inbox"], "write": ["out"] },
  "inputs": ["inbox/brief.md"],
  "prompt": "…",
  "network": "allow",
  "expectedArtifacts": ["out/report.md"],
  "acceptance": ["…"],
  "limits": { "maxMinutes": 20, "maxCostUsd": 1.5 },
  "checkpoint": { "enabled": true, "keep": 30 }
}
```

校验规则：

- `id` / `title` / `prompt` 非空；`chain` 必填，取 `research | csv | organize`。
- `network` 必填，取 `allow | deny`（缺省不放行）。
- `workspace.root` 必填；`read` / `write` 是**根下相对路径**，拒绝绝对路径、`..`、
  空串；`write` 不得为空。
- `inputs` 必须是根下相对路径，预检时存在。
- `checkpoint.keep ≥ 1`。
- 未知字段忽略（向前兼容），未知枚举值直接拒绝。

### 7.2 `run.json`

执行稿 7.1 的字段，加 `chain` / `workspaceRoot` / `pid` / `resumeCount` / `rerunOf`：

```json
{
  "runId": "run_20261102-101500-a1b2",
  "taskId": "research-cited-report-v01",
  "chain": "research",
  "taskPath": "/abs/path/tasks/research-cited-report-v01.json",
  "workspaceRoot": "/Users/me/REPO/conatus/products/conatus_work/var/workspaces/research-001",
  "pid": 48213,
  "sessionId": "events",
  "startedAt": "2026-11-02T10:15:00+08:00",
  "endedAt": null,
  "status": "running",
  "model": null,
  "resumeCount": 0,
  "rerunOf": null,
  "turns": { "start": null, "end": null },
  "checkpoint": { "status": "pending", "error": null },
  "usage": { "inputTokens": 0, "outputTokens": 0, "costUsd": 0.0 },
  "artifacts": [],
  "tools": ["read", "write", "edit", "list", "glob", "grep", "apply_patch", "move", "mkdir"],
  "forkSessionId": null,
  "humanEdits": [],
  "failure": { "category": null, "message": null }
}
```

`status ∈ {running, succeeded, failed, aborted}`；
`failure.category ∈ {artifact, llm, tool, timeout, budget, checkpoint, internal}`。

首次落盘在检查点绑定之前，因此 `turns.start` / `turns.end` 记 `null`，绑定后回填；
`checkpoint.status ∈ {pending, ok, error}`，收口时改写。`workspaceRoot` 与 `taskPath`
都存**绝对路径**，`resume` / `abort` 换 cwd 也能接回。

## 八、测试清单

单元（无外部 IO 或只用临时目录）：

1. `TaskSpec`：合法卡通过；缺 `network`、绝对路径、含 `..`、`write` 为空全部拒绝。
2. `RunStore`：JSON 往返、原子写、`sha256` 稳定。
3. `RootedFileSystem`：写 `out/` 通过；写 `out-evil/` 拒绝；`../` 拒绝；符号链接逃逸
   拒绝；读 `inbox/` 通过、读根外拒绝；根可 `listDir` 不可写；`remove(root)` 拒绝。
4. `mkdir` / `move`：正常路径、目标已存在失败、源不存在失败、越界拒绝。
5. `artifacts`：缺失 / 空文件 / 正常三种判定。
6. `abort_signal`：pid 不存在时走「当场收口」分支。

集成（临时目录，不联网、不调模型）：

7. 空任务卡跑通 → `succeeded`、`turns 0→1`、`checkpoint.status: ok`。
8. 期望产物缺失 → `failed` + `category: artifact`。
9. 执行体抛异常后 `resume` → `turns 1→2`、`resumeCount: 1`。
10. `abort` 已死进程的 run → `aborted` 且检查点已收口。

## 九、验收

```bash
dart analyze --fatal-infos
dart test products/conatus_work
dart run products/conatus_work/bin/runner.dart run \
  products/conatus_work/tasks/empty-smoke.json \
  --workspace products/conatus_work/var/workspaces/smoke
```

最后一条要产出 `status: succeeded`、`turns` 从 `0` 到 `1`、`artifacts: []` 的 `run.json`。

外加一条机检（不靠人眼）：测试里写 `out/../evil.txt` 必须拿到 `FS_SANDBOX_DENIED`。

## 十、明确不做

- 不接 Agent Loop、不调模型、不读模型环境变量。
- 不装 shell、不接 `websearch` / `webfetch`。
- 不接 `RevertService`（链 3 时再加 `conatus_checkpoint` 直接依赖）。
- 不做 fixtures 批量、不做产物进阶校验、不做 P50/P95 汇总。
- 不改 `packages/conatus_code`，不改 nava 的 `ReadOnlyPathGuard`。

## 十一、风险

| 风险 | 对策 |
|---|---|
| `recordTurn` 失败不抛出、轮次先 +1 | 收口必 await 并写 `checkpoint.error`；`resume` 按实际 turn 重算，不假设连续 |
| `LocalFileSystem` 的 `cwd` 只是相对基准，不是 jail | 写边界全部由 `RootedFileSystem` 承担，测试覆盖逃逸用例 |
| `events.jsonl` 复用会话 id `events` | 阶段 0 一运行一会话；undo 分叉后另起文件，届时在 `run.json.forkSessionId` 落点再评估 |
| 相对路径依赖当前工作目录 | CLI 全部按 `Directory.current` 解析并在摘要里打印绝对根，避免误跑 |
