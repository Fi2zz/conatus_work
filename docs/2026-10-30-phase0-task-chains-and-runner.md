# 阶段 0：三条任务链与最小运行器

- 日期：2026-10-30
- 状态：阶段 0 执行稿（未开工）
- 上游文档：`2026-10-30-desktop-workbench-feasibility.md`
- 范围：只定义阶段 0 的任务卡、最小运行器形态、产物与验收口径
- 不包含：Flutter / React UI、WebView 桥接、安装升级、Office 全套产物

> 本文回答上游文档第十二节的两个前置条件：**三条任务链的可执行样例**与**运行器形态**。
> 目标不是做产品，而是用最低成本验证：Conatus 能否稳定交付可验收的文件成果。

---

## 一、结论

1. 运行器采用 **库 + 薄 CLI**，不做终端产品、不做常驻 HTTP 服务、不做 UI。
2. 任务以 **JSON 任务卡**声明；运行记录与产物落在 `var/`，不进仓库。
3. 三条链各做 **10 个任务卡**，共 30 个真实任务；先跑通再谈桌面 Alpha。
4. 直接复用 `conatus_diff` / `conatus_fs_tools` / `conatus_checkpoint` /
   `conatus_checkpoint/revert.dart`，不重写变更保护。
5. 阶段 0 需要补的最小能力：`move` / `mkdir` 工具、**allow-list 写边界 FS**（`ReadOnlyPathGuard` 是 deny-list，不够用）、CSV 解析、SVG 图表生成、产物校验器。
6. 阶段 0 不接 Office（DOCX / XLSX / PPTX），不让产物库选型阻塞任务链验证。

---

## 二、运行器形态

### 2.1 为什么是「库 + 薄 CLI」

| 形态 | 判断 |
|------|------|
| 纯脚本集合 | 无法复用，指标散落，后续 UI 要重写 |
| CLI 里塞一套 Agent Loop | 与产品层耦合，桌面端无法复用 |
| 常驻 HTTP 服务 | 阶段 0 不需要，增加端口、生命周期与安全变量 |
| 直接做 Flutter / React | UI 会掩盖任务链问题，违背上游文档结论 |
| **库 + 薄 CLI** | **阶段 0 推荐**：可复用、可批量跑、可量化 |

CLI 只负责：

1. 加载任务卡；
2. 调用运行器库；
3. 打印进度与最终摘要。

不实现第二套 Agent Loop，不实现第二套 Session / 工具 / 审批。

### 2.2 目录结构

```text
products/conatus_work/
├── bin/
│   └── runner.dart                 # 薄 CLI
├── lib/
│   ├── conatus_work.dart
│   └── src/
│       ├── runner/
│       │   ├── task_spec.dart      # 任务卡模型 + 校验
│       │   ├── run_store.dart      # run.json / events.jsonl / artifacts
│       │   ├── workspace.dart      # 授权根、只读区、CheckpointPolicy
│       │   ├── assembly.dart       # Context + fs + tools + checkpoint + agent
│       │   └── runner.dart         # run / resume / abort
│       └── tools/
│           ├── move.dart           # 阶段 0 新增
│           ├── mkdir.dart          # 阶段 0 新增
│           └── rooted_fs.dart      # allow-list 写边界（ReadOnlyPathGuard 是 deny-list）
├── tasks/
│   ├── research-cited-report.json
│   ├── csv-sales-analysis.json
│   ├── folder-organize.json
│   └── fixtures/<chain>/v01..v10/  # 每个变体的输入：brief.md / sales.csv / inbox 树
└── var/                            # gitignored
    ├── workspaces/<run-id>/
    └── runs/<run-id>/
        ├── run.json
        ├── events.jsonl
        └── artifacts/
```

### 2.3 CLI 命令

```bash
# 列出任务卡
dart run bin/runner.dart list

# 跑一个任务
dart run bin/runner.dart run tasks/research-cited-report.json \
  --workspace var/workspaces/research-001

# 恢复（复用 session + checkpoint bind）
dart run bin/runner.dart resume <run-id>

# 中断（记录检查点并写 run.json）
dart run bin/runner.dart abort <run-id>

# 汇总指标
dart run bin/runner.dart report runs/

# 记录人工救场（改产物 / 补步骤 / 重跑）
dart run bin/runner.dart edit <run-id> --artifact out/report.md --note "手动改了结论段"
```

### 2.4 运行器装配

运行器内部只做一次装配，后续每个任务复用同一套：

```dart
final Context ctx = Context.root();

// 1. 文件系统：写边界 = 根内 + 任务卡 write 白名单
//    ReadOnlyPathGuard 是 deny-list（只能保护指定目录），LocalFileSystem(cwd:) 只是
//    相对路径基准、不是 jail，所以「不得写出授权根」必须由 allow-list 装饰器承担。
provideFileSystemLocal(
  ctx,
  fs: RootedFileSystem(
    inner: LocalFileSystem(cwd: workspaceRoot),
    root: workspaceRoot,
    writablePrefixes: task.workspace.write,
  ),
);

// 2. 工具
provideTools(ctx);
provideFsTools(
  ctx,
  options: FsToolOptions(
    enablePatch: true,
    skipDirs: <String>{...kDefaultSkipDirs, '.conatus_work'},
  ),
);

// 3. 检查点
final CheckpointOptions checkpointOptions = CheckpointOptions(
  enabled: task.checkpoint.enabled,
  keep: task.checkpoint.keep,
  policy: productCheckpointPolicy,
);
final CheckpointManager checkpoint = CheckpointManager(
  store: await openCheckpointStore(
    options: checkpointOptions,
    root: workspaceRoot,
    projectDir: runDir,
  ),
  options: checkpointOptions,
);

// 4. Agent / Session / 模型
// provideAgentLoop / provideSession / provideLlm 等按现有伞包 API 装配；
// task.network == 'deny' 时不装配 websearch / webfetch，并把工具清单写进 run.json。
```

依赖注意：`conatus_checkpoint/revert.dart` 是第二入口，伞包只导出主入口
（`lib/conatus.dart` 里没有它）。用到 `RevertService` 时，`conatus_work` 必须显式声明
`conatus_checkpoint` 的 git + `path: packages/conatus_checkpoint` 直接依赖，并补
`dependency_overrides`（workspace 形态由 filter 生成的 `pubspec_overrides.yaml` 清空）。
其余符号继续从伞包拿，不必铺 37 条。

约束：

- 状态权威只在 Dart 侧；
- 不把框架内部对象暴露给未来的 UI；
- 运行器库返回结构化结果，不靠打印文本判断成功。

---

## 三、任务卡规范

### 3.1 为什么用 JSON

- `conatus_work` 目前只依赖伞包，YAML 需要额外直接依赖；
- 任务卡以机器生成、校验、批量执行为主；
- 后续产品化可以再加 YAML 或可视化编辑器，不影响现在。

### 3.2 最小字段

```json
{
  "id": "task-id",
  "title": "任务标题",
  "workspace": {
    "root": "var/workspaces/run-001",
    "read": ["inbox", "data"],
    "write": ["out"]
  },
  "inputs": ["inbox/brief.md"],
  "prompt": "交给 Agent 的任务说明",
  "network": "allow",
  "expectedArtifacts": ["out/report.md"],
  "acceptance": ["验收判据 1", "验收判据 2"],
  "limits": {
    "maxMinutes": 20,
    "maxCostUsd": 1.5
  },
  "checkpoint": {
    "enabled": true,
    "keep": 30
  }
}
```

字段约束：

- `workspace.read` / `workspace.write` 必须是 `root` 下的相对路径；
- `write` 之外一律只读，由 allow-list FS 强制（见 2.4），不依赖工具自觉；
- `network: allow | deny`：`deny` 时不装配 `websearch` / `webfetch`，`run.json.tools` 留证；
- `expectedArtifacts` 是硬验收，由产物校验器判定（见 7.4），不是建议；
- `checkpoint.keep` 至少 ≥ 可撤销任务数 + 1；
- 任务卡不包含模型密钥、绝对路径、用户私有信息。

### 3.3 输入与变体

每条链 10 个变体，输入放 `tasks/fixtures/<chain>/v01..v10/`，任务卡按 `v01..v10` 命名。
变体只改输入与 `prompt`，`acceptance` 保持同一套，否则 30 次运行的判定不可比。

---

## 四、链 1：调研主题并生成带引用的报告

### 4.1 任务卡

```json
{
  "id": "research-cited-report",
  "title": "调研 macOS 本地优先 AI 工作台并生成带引用报告",
  "workspace": {
    "root": "var/workspaces/research-001",
    "read": ["inbox"],
    "write": ["out"]
  },
  "inputs": ["inbox/brief.md"],
  "prompt": "阅读 brief.md，围绕其中的 3 个问题做调研；至少 6 个来源，其中 3 个一手来源；输出 1500-2500 字中文报告，每个事实性结论必须有脚注；不确定的内容标记为推断。不得编造 URL 或引文。",
  "expectedArtifacts": [
    "out/report.md",
    "out/report.html",
    "out/sources.json"
  ],
  "acceptance": [
    "每个事实性结论有引用或标注推断",
    "sources.json 至少 6 条，含 url/title/kind/accessedAt/fetchedAt/httpStatus/quote",
    "只收录抓取成功的 URL（运行期事实，不做事后复检）",
    "没有写入 out/ 之外"
  ],
  "limits": { "maxMinutes": 20, "maxCostUsd": 1.5 },
  "checkpoint": { "enabled": true, "keep": 30 }
}
```

### 4.2 执行步骤

1. 读 `brief.md`，生成检索计划。
2. `websearch` 找候选来源，`webfetch` 取正文。
3. 抽取事实与引用，写 `sources.json`。
4. 生成 `report.md`，再渲染 `report.html`。
5. 自检引用覆盖、链接可达、字数。
6. 收口检查点。

### 4.3 产物

- `out/report.md`
- `out/report.html`：用最小 Markdown 子集渲染（标题 / 列表 / 表格 / 链接 / 脚注），不引入渲染库；超出子集的语法视为失败
- `out/sources.json`：每条含 `kind: primary | secondary`；primary = 官方文档 / 原始数据 / 论文原文
- `run.json`（含 token、成本、来源数、耗时）

### 4.4 验收与失败分类

| 检查 | 判据 |
|------|------|
| 引用覆盖 | 每个事实性结论有脚注或“推断”标记 |
| 来源数量 | ≥ 6，其中 ≥ 3 条 `kind: primary` |
| 来源真实性 | `sources.json` 只含运行期抓取成功的 URL，带 `fetchedAt` 与 `httpStatus` |
| 产物可用 | Markdown / HTML 可直接打开，HTML 只用约定子集 |
| 越界 | 没有写入 `out/` 之外 |

失败分类：来源不足、抓取失败、引用与正文不匹配、产物无法打开、超时、超预算。

### 4.5 10 个变体建议

- 3 个中文主题、3 个英文主题、2 个“一手来源优先”主题、2 个“时效性优先”主题。
- 每个变体只改 `brief.md` 与 `prompt`，任务卡结构不变。

---

## 五、链 2：分析 CSV / Excel 并生成图表和结论

阶段 0 先做 **CSV**；XLSX 作为同一任务卡的第二输入变体，等产物库选型后再开。

### 5.1 任务卡

```json
{
  "id": "csv-sales-analysis",
  "title": "分析销售 CSV，找出退款率异常并生成图表",
  "workspace": {
    "root": "var/workspaces/csv-001",
    "read": ["data"],
    "write": ["out"]
  },
  "inputs": ["data/sales.csv"],
  "prompt": "分析 data/sales.csv：按月、地区计算订单数、退款率、客单价；找出退款率异常并给出可能原因；生成一张 SVG 图表和一份 Markdown 结论。不要联网。",
  "network": "deny",
  "expectedArtifacts": [
    "out/analysis.md",
    "out/chart.svg",
    "out/clean.csv"
  ],
  "acceptance": [
    "行数、总订单、退款率可复算",
    "缺失/非法行在 analysis.md 中报告",
    "图表有标题、单位、月份和地区标签",
    "结论引用具体数值",
    "run.json.tools 不含 websearch / webfetch（network=deny）"
  ],
  "limits": { "maxMinutes": 10, "maxCostUsd": 0.8 },
  "checkpoint": { "enabled": true, "keep": 30 }
}
```

### 5.2 执行步骤

1. 读 CSV，识别 schema、缺失值、重复行。
2. 清洗并写 `out/clean.csv`。
3. 计算指标，生成 `out/analysis.md`。
4. 生成 `out/chart.svg`。
5. 自检数值与图表。
6. 收口检查点。

### 5.3 选型建议

| 能力 | 阶段 0 建议 |
|------|-------------|
| CSV 解析 | 纯 Dart `csv` 包；补许可证与维护状态后再定（上游第十二节第 3 项要求） |
| XLSX | 等选型后再开，不阻塞 CSV 链 |
| 图表 | 直接生成 SVG，不引入图表库 |
| PNG / PDF | 阶段 1 再做 |
| Python / 外部分析服务 | 不引入 |

### 5.4 10 个变体建议

- 销售、费用、客服工单三类数据；
- 每个类型 3-4 个变体：缺失值、重复行、异常值、地区对比、月度趋势；
- 每个变体只换数据文件与 `prompt`，验收判据保持同一套。

---

## 六、链 3：批量整理授权文件夹并生成变更清单

这是最依赖 Checkpoint / Undo 的一条链，也是文件工具缺口最明显的一条。

### 6.1 任务卡

```json
{
  "id": "folder-organize",
  "title": "按类型和月份整理授权文件夹并生成变更清单",
  "workspace": {
    "root": "var/workspaces/organize-001",
    "read": ["inbox"],
    "write": ["inbox", "out"]
  },
  "inputs": ["inbox"],
  "prompt": "把 inbox 下的文件按“类型/月份”整理到 inbox/organized/；不删除任何文件，冲突文件放入 inbox/quarantine/；先输出 dry-run 清单，确认后执行；执行后生成 changes.json 和 changes.md。",
  "expectedArtifacts": [
    "out/changes.json",
    "out/changes.md"
  ],
  "acceptance": [
    "dry-run 清单与实际移动一致",
    "每个移动都有 oldPath/newPath/sha256/reason",
    "没有写入授权根之外",
    "没有删除；冲突进入 quarantine",
    "撤销后目录树与运行前一致"
  ],
  "limits": { "maxMinutes": 10, "maxCostUsd": 0.5 },
  "checkpoint": { "enabled": true, "keep": 30 }
}
```

### 6.2 执行步骤

1. 扫描 `inbox/`。
2. 生成整理计划（按类型 / 月份）。
3. 输出 dry-run 清单，等待确认。
4. 执行移动、建目录、冲突隔离。
5. 生成 `changes.json` / `changes.md`。
6. 收口检查点；撤销用 `RevertService.undo`。

### 6.3 当前工具缺口

`conatus_fs_tools` 现在没有 `move` / `mkdir` / `trash`。

| 方案 | 评价 |
|------|------|
| 用 `run_code` / shell 调 `mv` | 最快，但绕过 fs 工具审批与审计；阶段 0 可用，不建议进产品 |
| 在阶段 0 运行器里加最小 `move` / `mkdir` 工具 | **推荐**：改动小，且与 checkpoint / approval 同一条管线 |
| 只生成清单、不真正移动 | 不能验证撤销，失去这条链的意义 |

阶段 0 先在 `conatus_work` 内实现 `move` / `mkdir`；等桌面端也稳定使用后，再考虑上提到 `conatus_fs_tools`。

另一个缺口不是工具而是边界：`ReadOnlyPathGuard` 是 deny-list，无法表达「只允许写 `inbox/` 与 `out/`」。
本链同时需要 allow-list 的 `RootedFileSystem`（见 2.4），否则「没有写入授权根之外」这条验收无法机检。

`RootedFileSystem` 在 `conatus_work` 内实现，本轮不抽包；**nava 的 fs jail 保持不动**，两边的边界实现
暂时各管一段。等桌面端稳定使用、语义确认后，再评估是否合并成共享包。

dry-run 确认在 headless CLI 里没有交互通道：用 `--yes` 显式放行，缺省打印清单后退出（不执行），
把「未确认就执行」当成失败。

### 6.4 10 个变体建议

- 按类型 / 按月 / 按项目三种规则；
- 包含冲突文件名、空目录、嵌套目录、只读文件；
- 2-3 个变体故意制造“计划与实际不一致”，验证 dry-run 与 abort；
- 每个变体都要求“撤销后目录树与运行前一致”。

---

## 七、运行记录与指标

### 7.1 `run.json`

每次运行写 `var/runs/<runId>/run.json`：

```json
{
  "runId": "run_...",
  "taskId": "research-cited-report",
  "sessionId": "session_...",
  "startedAt": "2026-10-30T10:00:00+08:00",
  "endedAt": "2026-10-30T10:18:00+08:00",
  "status": "succeeded",
  "model": "provider/model",
  "turns": { "start": 3, "end": 4 },
  "checkpoint": { "status": "ok", "error": null },
  "usage": {
    "inputTokens": 0,
    "outputTokens": 0,
    "costUsd": 0.0
  },
  "artifacts": [
    {
      "path": "out/report.md",
      "bytes": 12345,
      "sha256": "...",
      "check": { "exists": true, "nonEmpty": true, "passed": true }
    }
  ],
  "tools": ["read", "write", "edit", "move", "mkdir"],
  "forkSessionId": null,
  "humanEdits": [
    { "at": "2026-10-30T10:20:00+08:00", "artifact": "out/report.md", "note": "手动改了结论段" }
  ],
  "failure": { "category": null, "message": null }
}
```

### 7.2 `events.jsonl`

直接复用 Session Log 的事件流，不另造一套过程日志。

### 7.3 产物校验器

`expectedArtifacts` 必须机器判定，否则 30 次运行靠人眼、结论不可复现。最小判定：

- 路径存在且是文件；
- 非空（字节数 > 0）；
- 记录 `sha256` 与 `bytes`，便于撤销后比对与人工修改检测；
- 任务卡可选的额外规则：最小字数、必须包含某段标题、SVG 可解析。

校验不通过时 `run.json.status = failed`，`failure.category = artifact`，不进入人工判定。

### 7.4 人工救场记录

「80% 无需救场」是本阶段的核心门槛，必须可计数。三种记录方式，任选其一但要有：

1. `dart run bin/runner.dart edit <run-id> --artifact out/report.md --note "..."`；
2. 运行结束后对产物 `sha256` 复核，与 `run.json` 记录不一致即视为人工修改；
3. 重跑同一任务卡时记 `rerunOf`。

`humanEdits` 非空或 `rerunOf` 存在，该任务计为「需要救场」。

### 7.5 指标汇总

`dart run bin/runner.dart report runs/` 输出：

- 每链任务数、成功率、人工救场率；
- 平均耗时、P50 / P95；
- token 与成本；
- 失败分类分布；
- 产物一次通过率；
- 撤销成功率、撤销后二次损坏数。

---

## 八、Checkpoint / Undo 接线

阶段 0 按「一任务 = 一轮」：

```dart
await checkpoint.flush();
final int startTurn = checkpoint.turn;

// 执行任务
final String? snapshotError = await checkpoint.recordTurn(
  lastEventId: session.lastEventId,
);

runStore.finish(
  startTurn: startTurn,
  endTurn: checkpoint.turn,
  snapshotError: snapshotError,
);
```

规则：

- 任务开始前 `await checkpoint.flush()`，不要在上一轮回滚/快照在途时开新任务；
- 任务收口必须 `await recordTurn`；
- 失败 / 中断也要收口，并把 `snapshotError` 写进 `run.json`；
- 撤销用 `RevertService.undo(session, checkpoint.turn - startTurn)`；
- 不要用 `steps = 0` 调 undo（`steps < 1` 会被当成 1，先判空）；
- 撤销会 fork 出新会话：把 `UndoResult.stage.forkSessionId` 写进 `run.json.forkSessionId`，
  `resume` 与后续指标都认这个 id，否则会接回旧会话；
- headless 下 `RevertConfirmation.ask` 传 `null` 表示「不阻塞、直接撤」，不是自动确认语义，
  验证脚本要显式依赖这一点；
- `keep` 至少 ≥ 计划可撤销任务数 + 1，阶段 0 建议 30。

---

## 九、阶段 0 执行顺序

| 周 | 内容 | 产出 |
|----|------|------|
| 1 | 运行器骨架、任务卡模型、run store、CLI；并行做 `RootedFileSystem` 与 `move` / `mkdir` | 能跑一个空任务并写 run.json；写边界可机检 |
| 2 | 30 份 fixtures、产物校验器、人工救场记录；链 1 前 5 个任务 | 基座齐 + 首批报告 |
| 2-3 | 链 1 剩余 5 个、链 2 前 5 个 | 报告与 CSV 指标 |
| 3-4 | 链 2 剩余、链 3 全部 | 分析、SVG、变更清单、撤销验证 |
| 4-5 | 补齐缺口、重跑失败任务、汇总 | 30 次运行 + 阶段 0 结论 |

4 周是冲刺目标，按 5 周做计划。第 1 周必须同时排工具与骨架——`RootedFileSystem` 与
`move` / `mkdir` 不到位，三条链都跑不起来，但它们不该串行等到第 2 周。

阶段 0 的验收门槛沿用上游文档第十一节：

- 至少 80% 任务无需人工救场；
- 产物可直接交付；
- 中断与恢复正确；
- 文件变更可检查，撤销不造成二次数据损失；
- 没有越权写入或不可恢复的数据损失；
- 连续自用两周，确实比现成产品更符合自己的工作方式。

---

## 十、明确不做

- 不做 Flutter / React UI；
- 不做 WebView 桥接；
- 不做 DOCX / XLSX / PPTX 全套产物；
- 不做任务级并行撤销；
- 不做 Computer Use、多 Agent 专家团、技能市场、IM 遥控；
- 不把 Shell 当沙箱；
- 不用临时方案替代 `conatus_checkpoint`。

---

## 十一、一句话总结

**阶段 0 先用一个库 + 薄 CLI，跑 30 个 JSON 任务卡：带引用报告、CSV 分析 + SVG、授权文件夹整理 + 撤销。任务链稳了，再谈桌面 UI。**
