# React 工作台设计与可测性基线

- 日期：2026-11-03
- 状态：已实现（2026-11-04 回填；本轮 UI/壳侧增补见 `2026-11-04-ui-shell-handoff.md`）
- 上游文档（唯一事实来源，冲突时以上游为准）：
  1. `2026-10-30-desktop-workbench-feasibility.md`（决策稿，7.1 / 7.2 / 7.4）
  2. `2026-11-03-phase0-acceptance-report.md`（阶段 0 结论）
- 范围：React 侧工作台骨架、回放式桥接、测试基线
- 不包含：Flutter 桌面壳、真实 Dart 桥接实现、WebView 打包、Office / PDF 产物管线

> 本轮目的不是把界面做完整，而是把「事件怎么产生、怎么被消费」切干净，让组件与回放
> 可以脱离 Flutter、脱离网络、脱离真实时钟独立验证。界面是这套结构的第一个消费方。

## 一、结论

1. React 子项目落在 `products/conatus_work/ui/`，独立 `package.json`，不进 Dart workspace。
2. 桥接走**可注入的 transport**：生产将来是 WebView postMessage，本轮是回放器与内存传输。
3. 前端只有一个真相来源：`applyEvent(state, event)` 纯函数。派生量全部走 selector。
4. fixture 由 Node 脚本从 `var/runs/*` **生成并提交**，回放不依赖本机运行记录。
5. 时间用**虚拟时钟**注入，同一 fixture 两次回放终态必须深度相等。
6. 布局取三栏（任务 · 过程 · 产物/变更），视觉取高密度浅冷灰，暗色跟随系统。

## 二、本次定案（对话结论）

| 议题 | 结论 | 被否掉的方向 |
|---|---|---|
| 首版产出 | 导航全开 + 一条链路做深（任务 → 过程 → 产物 → 变更 → 撤销）；设置与审批可用但浅 | 只做差异化链路（入口不全，下次还得改壳）；全部等深但浅（没有一个功能能真用） |
| 布局 | 三栏：任务列表 / 时间线 / 产物·变更·检查点 tab | 双栏 + 抽屉（可回溯被藏在点击之后）；检查点时间轴主导航（聊天被降级） |
| 技术栈 | Vite + React 19 + TS + Tailwind v4 + shadcn/ui + Radix + Zustand + marked + DOMPurify | 零风格依赖（CSS 量太大）；只用组件库默认观感（密度不够） |
| 式样 | Porcelain：12–13px 基准、浅冷灰、细分割线、单一蓝强调色 | Graphite 深色（偏开发者工具）；Paper 暖白（一屏信息量减半） |
| 事件来源 | Node 生成器产出桥接事件流，前端只消费 | 前端内置投影（组件测试跨层、与 7.2 冲突）；本地 WebSocket 服务（不可确定性回放） |
| 包管理器 | npm | pnpm（本机有，但不该成为克隆前置） |
| 视觉打磨 | 不做品牌化与动效；`prefers-color-scheme` 切换暗色 | — |

## 三、分层与目录

```
products/conatus_work/
├─ ui/                              # React 子项目（独立 package.json）
│  ├─ src/
│  │  ├─ bridge/                    # 契约与传输（唯一事实源）
│  │  │  ├─ types.ts                # 命令 / 事件 / ViewModel
│  │  │  ├─ transport.ts            # BridgeTransport 接口
│  │  │  ├─ replay-transport.ts     # 虚拟时钟回放
│  │  │  └─ memory-transport.ts     # 测试用脚本传输
│  │  ├─ state/
│  │  │  ├─ workbench-state.ts      # 投影状态
│  │  │  ├─ apply-event.ts          # 纯 reducer（核心被测点）
│  │  │  ├─ ui-state.ts             # 输入框、选中 tab、折叠态、右栏宽度
│  │  │  └─ selectors.ts            # 可撤销范围、产物分组、diff 着色、指标汇总
│  │  ├─ features/                  # tasks / conversation / artifacts / changes / checkpoints / approval / settings
│  │  ├─ components/ui/             # shadcn 生成件（按需改，不当黑盒）
│  │  └─ fixtures/                  # 已提交的回放数据
│  │     ├─ runs/                   # 真实运行回放
│  │     └─ edge/                   # 人造边界用例（edge- 前缀）
│  ├─ tools/generate-fixtures.mjs   # var/runs → fixtures
│  └─ tests/{unit,component,e2e}/
```

两条硬性分层规则：

- **投影状态与界面状态分两个 slice。** 输入框里打了半句话、展开了一个工具参数，都不该让
  reducer 的断言变脏；反过来 `applyEvent` 也不能写 `selectedTab`。
- **大正文不进 state。** `ArtifactView` 只存路径、大小、校验与截断标记；预览通过
  `transport.readArtifact(runId, path)` 按需取。这与 7.2「大文件通过受控资源协议按需
  读取」对齐，也避免回放状态膨胀。

状态容器用 Zustand：`useWorkbenchStore` 与 `useUiStore` 各一个 store，store 内除
「调 `applyEvent` 再 `set`」之外不写逻辑；`selectors.ts` 是纯函数，可脱离 React 单测。
`.gitignore` 追加 `ui/node_modules/` 与 `ui/dist/`。

`package.json` 脚本：`dev` / `build` / `preview` / `test`（Vitest）/ `test:watch` /
`e2e`（Playwright）/ `lint`（tsc `--noEmit` + ESLint）。

## 四、桥接契约（v0）

### 4.1 命令（React → 宿主）

| 命令 | 入参 | 回报 |
|---|---|---|
| `task.list` | — | `RunSummary[]` |
| `task.open` | `runId` | `RunView`（等价于一次 `snapshot`） |
| `task.start` | `cardId` | `{ runId }` |
| `task.cancel` | `runId` | `{ status }` |
| `message.send` | `runId, text` | — |
| `approval.respond` | `requestId, 'allow' \| 'deny'` | — |
| `diff.open` | `runId, filePath?` | `ChangeSet` |
| `undo.request` | `runId, steps` | `UndoResult` |
| `redo.request` | `runId, steps` | `RedoResult` |
| `artifact.read` | `runId, path` | `{ content, truncated }` |

命令一律返回 `CommandResult = { ok: true, value } | { ok: false, error: BridgeError }`，
错误带 `code`（`NOT_FOUND` / `PRUNED` / `STALE_TURN` / `DENIED` / `INTERNAL`）。界面按
`code` 分支，不解析错误文案。

### 4.2 事件（宿主 → React）

连接后先推一条 `snapshot`（全量 `RunSummary[]` + 活动 `RunView`），避免回放跑到一半才有东西看。之后：

| 事件 | 关键字段 |
|---|---|
| `task/started` | `runId, taskId, title, chain, model, startedAt` |
| `task/status` | `runId, status` |
| `task/ended` | `runId, status, endedAt, failure{category,message}` |
| `message/user` | `runId, text` |
| `message/assistant/delta` | `runId, entryId, text` |
| `message/assistant/done` | `runId, entryId, text, reasoning?` |
| `tool/started` | `runId, callId, name, args, at` |
| `tool/finished` | `runId, callId, ok, summary, content?, durationMs` |
| `plan/updated` | `runId, items[{id,title,status}]` |
| `approval/requested` | `runId, requestId, callId, name, args, riskLevel` |
| `approval/resolved` | `runId, requestId, decision` |
| `artifact/added` \| `artifact/updated` | `runId, path, bytes, sha256, check` |
| `changes/updated` | `runId, summary, files[]` |
| `checkpoint/recorded` | `runId, turn, at, eventCount` |
| `usage/updated` | `runId, inputTokens, outputTokens, costUsd` |
| `undo/started` \| `undo/finished` | `runId, steps` / `ok, appliedSteps, failures[{path,error}]` |
| `redo/finished` | `runId, ok, appliedSteps, code?` |

事件统一带 `seq`（单调递增）与 `runId`。

### 4.3 归约规则

`applyEvent(state, event) → state` 必须满足：

- **纯**：不读时钟、不读 `Math.random`、不写外部变量，返回新对象（结构共享，不 mutate）。
- **幂等**：同一 `seq` 重复投递不改变 state（按 `(runId, seq)` 去重）。
- **不认识就记账**：未知 `type` 忽略并 `unknownEvents += 1`，用于发现契约漂移，不抛异常。
- **轮次洞可见**：`checkpoint/recorded` 的 `turn` 与已有最大轮次差大于 1 时，记录到
  `checkpoints.gaps`，界面据此显示黄条，撤销步数按实际存在的轮次计算。
- **撤销是事件**：`undo/finished` 除了改状态，还往 `timeline` 追加一条 `undo` 条目——
  撤销本身也要可回溯。
- **状态只存事实**：不存「当前能不能撤销」这类判断，那是 selector 的事。

```ts
type WorkbenchState = {
  runs: Record<string, RunView>
  order: string[]                 // startedAt 降序
  activeRunId: string | null
  unknownEvents: number
  seenSeqs: Record<string, true>  // 幂等去重：`${runId}:${seq}`
}

type RunView = {
  id: string; taskId: string; title: string; chain: string
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'aborted'
  model: string; startedAt: string; endedAt?: string
  usage: { inputTokens: number; outputTokens: number; costUsd: number }
  timeline: TimelineEntry[]       // 原始条目，未归组；归组与过滤由 selector 完成
  plan?: PlanItem[]
  approval?: ApprovalRequest
  artifacts: ArtifactView[]       // 只有引用，没有正文
  changes?: ChangeSet
  checkpoints: { currentTurn: number; keep: number; turns: TurnView[]; gaps: number[] }
}
```

## 五、回放与 fixture

### 5.1 生成器映射

`ui/tools/generate-fixtures.mjs` 读 `var/runs/<runId>/{run.json,events.jsonl}`：

| 源 | 目标 |
|---|---|
| `run.json` | fixture `run` 段（id / taskId / title / chain / status / model / startedAt / usage / turns） |
| `user/message` | `message/user` |
| `assistant/message` | `message/assistant/done` + 每个 `toolCalls[i]` 一条 `tool/started` |
| `tool/result` | `tool/finished`（`isError` → `ok: false`） |
| `seq` / `time` | 毫秒偏移 `at`（相对 `startedAt`），`seq` 重新编号 |

生成器是**幂等**的：同输入两次运行输出逐字节相同（键排序 + 固定缩进），便于 code review
与 git diff。

fixture 形状（字段名即契约，Dart 侧实现必须产出同样的键）：

```json
{
  "schemaVersion": 1,
  "run": {
    "id": "run_20261102-173641-1fd4", "taskId": "folder-organize-v01",
    "title": "按类型和月份整理收件箱并生成变更清单", "chain": "organize",
    "status": "succeeded", "model": "opencode-go/deepseek-v4.1-flash",
    "startedAt": "2026-11-02T17:36:41.762+08:00", "endedAt": "2026-11-02T17:37:54.101+08:00",
    "usage": { "inputTokens": 41230, "outputTokens": 6102, "costUsd": 0.002431 },
    "workspaceRoot": "var/workspaces/organize-v01", "synthetic": false
  },
  "events": [
    { "seq": 0, "at": 0, "type": "message/user", "data": { "text": "把 inbox 下的文件…" } },
    { "seq": 1, "at": 2155, "type": "tool/started",
      "data": { "callId": "call_00_…", "name": "list", "args": "{\"path\":\"inbox\"}" } }
  ],
  "artifacts": [
    { "path": "out/changes.json", "bytes": 4863, "sha256": "c315…",
      "check": { "exists": true, "nonEmpty": true, "passed": true } }
  ],
  "files": { "out/changes.md": "# 变更清单\n…", "out/changes.json": "{\n  \"operations\": […]" },
  "changes": {
    "summary": { "added": 0, "modified": 0, "moved": 11, "deleted": 0 },
    "files": [{ "from": "inbox/a.docx", "to": "inbox/organized/docx/2026-01/a.docx",
                "sha256": "…", "reason": "按类型/月份" }]
  },
  "checkpoints": {
    "startTurn": 0, "currentTurn": 3, "keep": 5,
    "turns": [{ "turn": 1, "at": "2026-11-02T17:37:12+08:00", "eventCount": 18 }],
    "gaps": []
  }
}
```

`files` 是内联正文，超过 64 KB 时截断并把 `truncated: true` 写进对应 `artifacts` 项。

### 5.2 变更集来源（按优先级，不编数据）

1. `out/changes.json`（含 `operations[].sha256`、`summary`）——直接采用；
2. 该文件缺失时，从 `move` 工具结果反推 `from / to / sha256`；
3. 仍缺则 `changes` 置 `null`，界面显示「该运行未记录变更」，不画空 diff。

### 5.3 提交的 fixture 清单

| 文件 | 来源 | 用途 |
|---|---|---|
| `runs/organize-v01.json` | 真实运行 | 主回放：11 移动 / 0 删除 / 2 产物，带撤销 |
| `runs/csv-sales-analysis-v01.json` | 真实运行 | 产物含图表引用、非文本产物 |
| `runs/research-cited-report-v01.json` | 真实运行 | 长文本、多工具、长耗时 |
| `edge/edge-undo-failed.json` | 人造 | 撤销逐文件失败 + 重试路径 |
| `edge/edge-redo-pruned.json` | 人造 | `redo` 目标轮次被裁剪（`PRUNED`） |
| `edge/edge-checkpoint-gap.json` | 人造 | 轮次洞（1 → 3） |
| `edge/edge-approval-denied.json` | 人造 | 审批拒绝后事件流留下记录 |

人造文件统一 `edge-` 前缀，界面上标「合成数据」角标，避免与真实运行混淆。

### 5.4 虚拟时钟与确定性

```ts
interface Scheduler { now(): number; after(ms: number, fn: () => void): () => void }
```

- 生产 / dev：`RealScheduler`，`?speed=` 控制倍速，`0` 表示一次性推到终态。
- 测试：`ManualScheduler`，`advance(ms)` 同步推进；回放完全同步、零 flake。
- `ReplayTransport(fixture, { scheduler, speed })` 只依赖 `Scheduler`，不直接调 `setTimeout`。
- 恒定用例：同一 fixture 用 `ManualScheduler` 跑两遍，最终 `WorkbenchState` 深度相等。

## 六、界面结构

### 6.1 三栏

| 区域 | 宽度 | 内容 |
|---|---|---|
| 左栏 | 240px（可折到 56px rail） | 工作区名 + 新任务；任务列表按今天／更早分组（状态点、标题、模型·耗时·成本）；底部 `设置` 与 `可撤销 N 轮` |
| 中栏 | 弹性 | 任务头（标题、状态 chip、模型、耗时、成本；运行中可「停止」，失败后可「重试」走 `task.start`）→ 时间线 → 审批条 → composer |
| 右栏 | 380px（可拖拽） | tabs：`产物` / `变更` / `检查点` |

### 6.2 时间线

- 条目一律左对齐：审计视图不做左右气泡。用户条目淡底，助手条目无底，工具条目单行。
- 工具条目：`name` + 参数摘要 + 状态 + 耗时；点开展开原始入参/出参；`ok: false` 左侧红边。
- 连续同类工具自动归组为 `move ×11`，展开后仍是逐条。
- 顶部过滤器 **只看关键事件 / 全部**：默认隐藏成功的 `list` / `read` / `glob`，失败与写操作一律保留。
- `assistant` 的 `reasoning` 非空时折叠成「思考」块，默认收起。

### 6.3 审批

审批条贴在 composer 上方，显示工具名、参数摘要、风险等级、`允许` / `拒绝` / `查看参数`。
出现时 composer 禁用。`approval/resolved` 落进时间线，事后可回看谁批的、批了什么。

### 6.4 撤销

1. 右栏「变更」底部 `撤销这批变更` → 确认对话框：**撤销 N 轮，回退到轮次 X（时间），
   涉及 M 个文件；检查点只保留最近 K 轮**；
2. 执行期间右栏显示进度，时间线追加 `undo` 条目；
3. 成功：任务与变更区标「已撤销到轮次 X」，`重做` 可用；
4. 失败：对话框内逐文件列出 `path + error`，提供 `重试` 与 `保留现状`；不做成 toast。

`PRUNED`（目标轮次已被裁剪）必须显示「无法撤销/重做：轮次 X 已不在保留范围」，并给出
当前可撤销范围。

### 6.5 边界状态

| 状态 | 呈现 |
|---|---|
| 无任务 | 左栏空态 + 「新建任务」主按钮，中栏说明可回放哪些 fixture |
| fixture 缺失 / 解析失败 | 整页错误卡，附出错的 fixture 名与字段 |
| 回放结束 | 任务头状态收敛，composer 提示「回放已结束，发送消息不会被执行」 |
| 产物正文不可用 / 被截断 | 预览区注明原因，不显示空白 |
| 检查点轮次洞 | 顶部黄条：撤销步数按实际存在的轮次计算 |
| 未知事件 | 不提示用户；开发模式下角标显示 `unknownEvents` 计数 |

## 七、视觉与组件

- Porcelain：`#f7f8fa` 底、`#ffffff` 面板、`#dcdfe5` 细线、`#0b62d6` 强调色；字号 12–13px；
  `prefers-color-scheme: dark` 切换暗色令牌。
- shadcn/ui 组件按需生成后**本地可改**：`Tabs` / `Dialog` / `Tooltip` / `ScrollArea` /
  `Command`（⌘K）/ `Badge` / `Switch`。表单控件不进 shadcn 默认外观，按密度调。
- 路径、工具名、diff 使用等宽字体（`ui-monospace` 栈）。
- 产物预览：Markdown（`marked` + `DOMPurify`）、纯文本、HTML（`sandbox="allow-scripts"` 的 iframe，
  不带 `allow-same-origin`）。
- 快捷键：`⌘K` 切任务；`⌘Z` 打开撤销确认（**不直接执行**）。

## 八、测试清单

| 层 | 位置 | 覆盖 |
|---|---|---|
| reducer 单测 | `tests/unit/apply-event.test.ts` | 每种事件；重复 `seq` 幂等；未知事件计数；轮次洞；撤销追加时间线条目 |
| selector 单测 | `tests/unit/selectors.test.ts` | 可撤销范围计算；关键事件过滤；diff 行着色；指标汇总 |
| 确定性 | `tests/unit/replay-determinism.test.ts` | 同 fixture 两遍，终态深度相等 |
| 组件测试 | `tests/component/*.test.tsx` | 时间线折叠与归组；审批条禁用 composer；撤销失败列表；产物预览截断提示 |
| 回放 e2e | `tests/e2e/replay.spec.ts` | `?fixture=…&speed=0` 下三条真实回放：产物、变更数、可撤销范围、撤销后状态 |
| 边界 e2e | `tests/e2e/edge.spec.ts` | 撤销失败、redo 被裁剪、轮次洞、审批拒绝四条 |

组件测试用 `MemoryTransport` 或直接给组件传 state，禁止 mock `applyEvent`。

## 九、验收

```bash
cd products/conatus_work/ui
npm install
node tools/generate-fixtures.mjs     # 从 var/runs 重新生成（幂等）
npm run dev                          # 三栏工作台默认加载 organize-v01
npm test                             # reducer + selector + 组件 + 确定性
npm run e2e                          # Playwright 回放与边界
npm run build                        # 产物可被 WebView 加载
```

同时满足：

1. 三个真实 fixture 可切换，切换后时间线、产物、变更、可撤销范围同步更新。
2. 产物 Markdown 可预览；HTML 走 sandbox iframe；正文缺失时显示明确原因。
3. 撤销成功与撤销失败两条路径都可复现、都可读。
4. `unknownEvents` 在正常回放中恒为 0。
5. 同一 fixture 两次回放终态相等。

## 十、明确不做

**2026-11-04 回填：以下各项中已完成的部分已标注。**

已落地：

- 真实 WebView 桥接（`ui/src/bridge/webview-transport.ts` + `lib/src/bridge/host.dart`）
  与 Flutter 桌面壳（`shell/`）。
- 真实任务执行：`task.start` / `task.cancel`（未配置模型时明确报错）。
- PDF 预览（blob URL）与图片 / CSV / TSV 预览。
- DOCX / XLSX / XLS 内嵌预览（`docx-preview` + SheetJS，按需加载）。
- 时间线零依赖虚拟化（`content-visibility`）。
- UI CI：Vitest + Playwright 已进 `.github/workflows/test.yml`。
- `message.send` / `approval.respond`：Dart 侧已实现真实续写与审批源，UI 已适配
  （运行中只显示停止，结束后可续写；审批失败保留审批条）。

仍未做：

- PPTX 内嵌预览与 Office 产物管线（DOCX / XLSX 已支持预览）。
- 多任务并行执行与并行撤销（首版保持「一任务 = 一轮」）。
- 安装升级、macOS 签名与公证、Windows 适配。
- 品牌化视觉、动效、i18n（文案直接写中文）。

## 十一、风险

| 风险 | 影响 | 对策 |
|---|---|---|
| fixture 与真实桥接漂移 | 界面在回放上成立、接 Dart 后崩 | 契约集中在 `bridge/types.ts`；Dart 实现落地时用同一份 fixture 对拍 |
| 真实运行记录缺变更集 | diff 视图无数据可测 | 生成器三级来源 + 缺失时显式标注，不编造 |
| 只在单模型单任务上回放 | 长任务、失败多样性的界面缺口没暴露 | 四个人造边界场景覆盖失败路径；后续按需扩充 |
| `var/runs` 被清空 | 生成器不可重跑 | fixture 已提交；生成器只作为再生成工具 |
| WebView 的 CSP / 资源协议差异 | 预览与字体在壳里表现不同 | 本轮不打包，只保证 `npm run build` 产物自包含、无外部 CDN 依赖 |
