# React 工作台实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `products/conatus_work/ui/` 交付一个可运行的 React 三栏工作台，数据来自可确定性回放的桥接事件流，组件与回放均可脱离 Flutter 独立测试。

**Architecture:** Node 生成器把 `var/runs/*` 转成已提交的桥接事件流 fixture；前端只有一个纯函数 `applyEvent` 持有投影状态，派生量走 selector；transport 可注入，生产将来是 WebView 桥、测试是 `ManualScheduler`；UI 状态单独一个 store。

**Tech Stack:** Vite 6 + React 19 + TypeScript + Tailwind v4 + shadcn/ui + Radix + Zustand + marked + DOMPurify；测试用 Vitest + Testing Library + Playwright。

**Spec:** `products/conatus_work/docs/2026-11-03-react-workbench-design.md`

## Global Constraints

- 所有包在 `products/conatus_work/ui/` 下，独立 `package.json`，不进 Dart workspace；包管理器只用 **npm**。
- 界面文案一律中文；代码标识符英文；布尔变量/函数不用 `is/has/can/should` 前缀。
- 单文件 ≤ 200 行、单函数 ≤ 40 行；超了拆文件（仓库硬约束）。
- 基准字号 12–13px，强调色 `#0b62d6`，面板 `#ffffff`，底色 `#f7f8fa`，细线 `#dcdfe5`；暗色跟随 `prefers-color-scheme`。
- 构建产物不得引用外部 CDN；HTML 预览必须 `sandbox="allow-scripts"` 且不带 `allow-same-origin`。
- 时间只经 `Scheduler` 取，代码里禁止直接 `setTimeout` / `Date.now`（`realScheduler` 除外）。
- `applyEvent` 纯净：不读时钟、不读随机、不 mutate 入参。
- 不新增 spec 未列出的运行时依赖。
- 提交信息：`feat(work-ui): …` / `test(work-ui): …` / `chore(work-ui): …`。

## Review Focus

1. **重复或乱序的 `seq`** —— 宿主重连后重投事件时，时间线不得翻倍或错序。
2. **`at` 非单调的 fixture** —— 真实日志里同毫秒事件很常见，回放不得丢事件、不得死循环。
3. **产物正文里的 HTML/脚本** —— 预览必须隔离，不能执行、不能读宿主 `localStorage`。
4. **`undo` 的 `steps = 0` 或目标轮次已被裁剪** —— 界面必须拦截或在弹窗里说清，而不是静默撤掉一轮。
5. **缺失字段（`changes` 为 `null`、`files` 里没有正文）** —— 面板要给出明确原因，不能白屏或崩。

---

### Task 1: ui 子项目与测试基线

**Files:**
- Create: `ui/package.json`、`ui/vite.config.ts`、`ui/tsconfig.json`、`ui/tsconfig.node.json`、`ui/index.html`、`ui/components.json`、`ui/src/lib/utils.ts`、`ui/src/styles/globals.css`、`ui/src/main.tsx`、`ui/src/app/App.tsx`、`ui/vitest.config.ts`、`ui/vitest.setup.ts`、`ui/playwright.config.ts`、`ui/src/app/App.test.tsx`、`ui/.gitignore`、`ui/README.md`
- Modify: `products/conatus_work/docs/…`（无）、`products/conatus_work/.gitignore`（已在 round 1 加了 `.superpowers/`，本轮追加 `ui/node_modules/`、`ui/dist/`）

**Interfaces:**
- Produces: `App()` 默认导出的根组件；路径别名 `@/* → src/*`；`cn(...classes)` 工具。

- [ ] **Step 1: 写失败测试**

`ui/src/app/App.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

it('renders the workbench shell', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Conatus Work' })).toBeInTheDocument()
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd products/conatus_work/ui && npx vitest run src/app/App.test.tsx`
Expected: 失败，`Cannot find module './App'`。

- [ ] **Step 3: 搭脚手架**

依赖（精确）：
`react@19 react-dom@19 zustand marked dompurify clsx tailwind-merge class-variance-authority lucide-react`
开发依赖：`vite @vitejs/plugin-react typescript @types/react @types/react-dom tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @playwright/test`

`vite.config.ts`：`react()` + `tailwindcss()`，`resolve.alias['@'] = '/src'`，`build.outDir = 'dist'`。
`tsconfig.json`：`strict: true`，`paths: { "@/*": ["./src/*"] }`，`moduleResolution: "bundler"`。
`vitest.config.ts`：`environment: 'jsdom'`、`globals: true`、`setupFiles: ['./vitest.setup.ts']`、`exclude: ['tests/e2e/**','node_modules/**']`。
`vitest.setup.ts`：`import '@testing-library/jest-dom/vitest'`。
`globals.css`：`@import "tailwindcss";` + `@theme` 里定义 Global Constraints 的色值与 `--font-mono`。
`components.json`（手写，不跑交互式 init）：`style: "new-york"`、`rsc: false`、`tsx: true`、`tailwind.config: ""`、`aliases: { components: "@/components", ui: "@/components/ui", utils: "@/lib/utils" }`。
`playwright.config.ts`：`testDir: './tests/e2e'`、`webServer: { command: 'npm run preview -- --port 4173', port: 4173, reuseExistingServer: true }`。
`package.json` 脚本：`dev`、`build`、`preview`、`test: "vitest run"`、`test:watch: "vitest"`、`e2e: "playwright test"`、`lint: "tsc --noEmit"`。

`App.tsx` 先返回 `<h1>Conatus Work</h1>`，后续任务替换为三栏壳。

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -- src/app/App.test.tsx` → PASS；`npm run lint` → 无错误。

- [ ] **Step 5: 提交**

```bash
git add products/conatus_work/ui products/conatus_work/.gitignore
git commit -m "feat(work-ui): ui 子项目与测试基线"
```

---

### Task 2: 桥接契约与事件常量

**Files:**
- Create: `ui/src/bridge/types.ts`、`ui/src/bridge/events.ts`、`ui/src/bridge/transport.ts`、`ui/tests/unit/contract.test.ts`

**Interfaces:**
- Produces（后续任务全部依赖这些名字）：

```ts
export type RunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'aborted'
export type RiskLevel = 'low' | 'medium' | 'high'
export type Bool = boolean
export interface Usage { inputTokens: number; outputTokens: number; costUsd: number }
export interface RunSummary { id: string; taskId: string; title: string; chain: string;
  status: RunStatus; model: string; startedAt: string; endedAt?: string; usage: Usage }
export interface ArtifactCheck { exists: Bool; nonEmpty: Bool; passed: Bool; reason?: string | null }
export interface ArtifactView { path: string; bytes: number; sha256: string;
  check: ArtifactCheck; truncated?: Bool }
export interface ChangeFile { from: string; to: string; sha256: string; reason?: string }
export interface ChangeSummary { added: number; modified: number; moved: number; deleted: number }
export interface ChangeSet { summary: ChangeSummary; files: ChangeFile[] }
export interface TurnView { turn: number; at: string; eventCount: number }
export interface CheckpointView { currentTurn: number; keep: number; turns: TurnView[]; gaps: number[] }
export interface PlanItem { id: string; title: string; status: 'todo' | 'doing' | 'done' | 'failed' }
export interface ApprovalRequest { requestId: string; callId: string; name: string;
  args: string; riskLevel: RiskLevel }
export interface Failure { path: string; error: string }

export type TimelineEntry =
  | { kind: 'user'; id: string; at: number; text: string }
  | { kind: 'assistant'; id: string; at: number; text: string; reasoning?: string; streaming?: Bool }
  | { kind: 'tool'; id: string; callId: string; at: number; name: string; args: string;
      ok?: Bool; summary?: string; content?: string; durationMs?: number }
  | { kind: 'approval'; id: string; at: number; requestId: string; name: string;
      decision?: 'allow' | 'deny' }
  | { kind: 'undo'; id: string; at: number; steps: number; ok: Bool; failures: Failure[] }
  | { kind: 'status'; id: string; at: number; status: RunStatus; text?: string }

export interface RunView {
  id: string; taskId: string; title: string; chain: string; status: RunStatus
  model: string; startedAt: string; endedAt?: string; usage: Usage
  timeline: TimelineEntry[]; plan?: PlanItem[]; approval?: ApprovalRequest
  artifacts: ArtifactView[]; changes: ChangeSet | null; checkpoints: CheckpointView
}
export interface WorkbenchState {
  runs: Record<string, RunView>; order: string[]; activeRunId: string | null
  unknownEvents: number; seenSeqs: Record<string, true>
}
export type BridgeErrorCode = 'NOT_FOUND' | 'PRUNED' | 'STALE_TURN' | 'DENIED' | 'INTERNAL'
export interface BridgeError { code: BridgeErrorCode; message: string }
export type CommandResult<T> = { ok: true; value: T } | { ok: false; error: BridgeError }
export interface UndoResult { ok: Bool; appliedSteps: number; failures: Failure[]; code?: BridgeErrorCode }
export interface RedoResult { ok: Bool; appliedSteps: number; code?: BridgeErrorCode }
```

`ui/src/bridge/events.ts`：

```ts
export type BridgeEvent =
  | { seq: number; at: number; type: 'snapshot'; data: { runs: RunSummary[]; activeRunId: string | null } }
  | { seq: number; at: number; type: 'task/started'; runId: string; data: { taskId: string; title: string; chain: string; model: string; startedAt: string } }
  | { seq: number; at: number; type: 'task/status'; runId: string; data: { status: RunStatus } }
  | { seq: number; at: number; type: 'task/ended'; runId: string; data: { status: RunStatus; endedAt: string; failure: { category: string | null; message: string | null } } }
  | { seq: number; at: number; type: 'message/user'; runId: string; data: { text: string } }
  | { seq: number; at: number; type: 'message/assistant/delta'; runId: string; data: { entryId: string; text: string } }
  | { seq: number; at: number; type: 'message/assistant/done'; runId: string; data: { entryId: string; text: string; reasoning?: string } }
  | { seq: number; at: number; type: 'tool/started'; runId: string; data: { callId: string; name: string; args: string } }
  | { seq: number; at: number; type: 'tool/finished'; runId: string; data: { callId: string; name: string; ok: Bool; summary: string; content?: string; durationMs: number } }
  | { seq: number; at: number; type: 'plan/updated'; runId: string; data: { items: PlanItem[] } }
  | { seq: number; at: number; type: 'approval/requested'; runId: string; data: ApprovalRequest }
  | { seq: number; at: number; type: 'approval/resolved'; runId: string; data: { requestId: string; name: string; decision: 'allow' | 'deny' } }
  | { seq: number; at: number; type: 'artifact/added' | 'artifact/updated'; runId: string; data: ArtifactView }
  | { seq: number; at: number; type: 'changes/updated'; runId: string; data: ChangeSet }
  | { seq: number; at: number; type: 'checkpoint/recorded'; runId: string; data: { turn: number; at: string; eventCount: number } }
  | { seq: number; at: number; type: 'usage/updated'; runId: string; data: Usage }
  | { seq: number; at: number; type: 'undo/started'; runId: string; data: { steps: number } }
  | { seq: number; at: number; type: 'undo/finished'; runId: string; data: UndoResult & { steps: number } }
  | { seq: number; at: number; type: 'redo/finished'; runId: string; data: RedoResult & { steps: number } }

export const EVENT_TYPES = [ /* 上述 type 字面量，snapshot 除外 */ ] as const
export type BridgeEventType = (typeof EVENT_TYPES)[number]
```

`ui/src/bridge/transport.ts`：

```ts
export interface BridgeTransport {
  connect(): Promise<void>
  disconnect(): void
  subscribe(listener: (event: BridgeEvent) => void): () => void
  listTasks(): Promise<CommandResult<RunSummary[]>>
  openTask(runId: string): Promise<CommandResult<RunView>>
  startTask(cardId: string): Promise<CommandResult<{ runId: string }>>
  cancelTask(runId: string): Promise<CommandResult<{ status: RunStatus }>>
  sendMessage(runId: string, text: string): Promise<CommandResult<void>>
  respondApproval(requestId: string, decision: 'allow' | 'deny'): Promise<CommandResult<void>>
  openDiff(runId: string, filePath?: string): Promise<CommandResult<ChangeSet>>
  undo(runId: string, steps: number): Promise<CommandResult<UndoResult>>
  redo(runId: string, steps: number): Promise<CommandResult<RedoResult>>
  readArtifact(runId: string, path: string): Promise<CommandResult<{ content: string; truncated: Bool }>>
}
```

- [ ] **Step 1: 写失败测试** `ui/tests/unit/contract.test.ts`

```ts
import { EVENT_TYPES } from '@/bridge/events'

it('covers every event type in the spec', () => {
  const expected = ['task/started','task/status','task/ended','message/user','message/assistant/delta',
    'message/assistant/done','tool/started','tool/finished','plan/updated','approval/requested',
    'approval/resolved','artifact/added','artifact/updated','changes/updated','checkpoint/recorded',
    'usage/updated','undo/started','undo/finished','redo/finished']
  expect([...EVENT_TYPES]).toEqual(expected)
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- tests/unit/contract.test.ts`，Expected: 模块不存在。
- [ ] **Step 3: 落地 `types.ts` / `events.ts` / `transport.ts`**（内容见 Interfaces，逐字使用）。
- [ ] **Step 4: 跑测试确认通过** — Run: `npm test -- tests/unit/contract.test.ts` → PASS；`npm run lint` → 无错误。
- [ ] **Step 5: 提交** — `git commit -m "feat(work-ui): 桥接契约与事件常量"`

---

### Task 3: applyEvent 骨架、生命周期、用量、幂等

**Files:**
- Create: `ui/src/state/workbench-state.ts`、`ui/src/state/apply-event.ts`、`ui/tests/unit/apply-event-lifecycle.test.ts`

**Interfaces:**
- Consumes: Task 2 的全部类型。
- Produces: `initialWorkbenchState: WorkbenchState`；`applyEvent(state: WorkbenchState, event: BridgeEvent): WorkbenchState`。

- [ ] **Step 1: 写失败测试**

```ts
it('builds run order from snapshot', () => {
  const s = applyEvent(initialWorkbenchState, snapshotEvent([runA, runB], 'run-b'))
  expect(s.order).toEqual(['run-b', 'run-a'])          // startedAt 降序
  expect(s.activeRunId).toBe('run-b')
})
it('task/status only changes status', () => { /* 其余字段引用相等 */ })
it('task/ended records failure category', () => { /* runs[r].status==='failed'; endedAt 已写入 */ })
it('usage/updated overwrites accumulated usage', () => { /* costUsd 取新值而非累加 */ })
it('repeated seq is idempotent', () => {
  const once = applyEvent(initialWorkbenchState, userMessageEvent(7))
  const twice = applyEvent(once, userMessageEvent(7))
  expect(twice).toBe(once)                             // 引用相等
})
it('unknown event only bumps counter', () => {
  const s = applyEvent(initialWorkbenchState, { seq: 99, at: 0, type: 'future/thing', data: {} } as never)
  expect(s.unknownEvents).toBe(1)
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- tests/unit/apply-event-lifecycle.test.ts`。
- [ ] **Step 3: 实现** — `initialWorkbenchState = { runs: {}, order: [], activeRunId: null, unknownEvents: 0, seenSeqs: {} }`。`applyEvent` 先用 `seq` 查 `seenSeqs` 早退返回原 state；`snapshot` 建 `runs` 但**不**清空已有条目（重连场景保留时间线）；新增 run 后按 `startedAt` 降序重排 `order`；`task/ended` 与 `usage/updated` 只改对应字段。
- [ ] **Step 4: 跑测试确认通过** — Run: `npm test -- tests/unit/apply-event-lifecycle.test.ts` → PASS。
- [ ] **Step 5: 提交** — `git commit -m "feat(work-ui): applyEvent 生命周期与幂等"`

---

### Task 4: applyEvent 消息、工具、计划、审批

**Files:**
- Modify: `ui/src/state/apply-event.ts`
- Create: `ui/tests/unit/apply-event-timeline.test.ts`

**Interfaces:**
- Produces: 时间线条目 `kind: 'user' | 'assistant' | 'tool' | 'approval'`；`runs[id].approval`。

- [ ] **Step 1: 写失败测试**

```ts
it('appends a user entry', () => { /* timeline.at === 3000，text 一致 */ })
it('accumulates assistant deltas into one entry', () => {
  // delta(a) → delta(b) → expect 单条 assistant，text === 'ab'，streaming === true
})
it('done replaces streaming text with final text', () => { /* text 与 reasoning 以 done 为准，streaming 取消 */ })
it('tool/finished backfills ok and duration', () => { /* entry.callId 匹配；ok/durationMs 写入 */ })
it('tool/finished without start still appends an entry', () => { /* 迟到结果不丢 */ })
it('plan/updated replaces the plan', () => {})
it('approval/requested sets run.approval', () => {})
it('approval/resolved clears it and appends an audit entry', () => {
  // timeline 末条 kind==='approval' 且 decision==='deny'
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- tests/unit/apply-event-timeline.test.ts`。
- [ ] **Step 3: 实现** — 追加条目用不可变数组；`delta` 按 `data.entryId` 查找已有 assistant 条目，找不到就新建；`tool/finished` 按 `callId` 反查，找不到就追加一条带 `ok` 的条目。
- [ ] **Step 4: 跑测试确认通过** — 同上文件 → PASS。
- [ ] **Step 5: 提交** — `git commit -m "feat(work-ui): applyEvent 时间线条目"`

---

### Task 5: applyEvent 产物、变更、检查点、撤销

**Files:**
- Modify: `ui/src/state/apply-event.ts`
- Create: `ui/tests/unit/apply-event-changes.test.ts`

**Interfaces:**
- Produces: `runs[id].artifacts` / `.changes` / `.checkpoints`；`kind: 'undo' | 'status'` 条目。

- [ ] **Step 1: 写失败测试**

```ts
it('adds an artifact once even if added twice', () => { /* 路径去重，保留较新的一份 */ })
it('replaces the change set', () => {})
it('appends a checkpoint turn and updates currentTurn', () => {})
it('records a gap when turn jumps', () => {
  // turns 1 → 3，expect checkpoints.gaps === [2]
})
it('undo/finished appends an auditable entry with failures', () => {
  // kind==='undo'，failures.length === 2
})
it('failed undo still records appliedSteps', () => { /* appliedSteps === 1 */ })
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- tests/unit/apply-event-changes.test.ts`。
- [ ] **Step 3: 实现** — `checkpoint/recorded` 计算 `turn - lastTurn - 1` 差集填 `gaps`；`undo/finished` 同时更新 `timeline` 与（当 `ok` 时）把 `checkpoints.currentTurn` 回退 `appliedSteps`。
- [ ] **Step 4: 跑测试确认通过** — 同上文件 → PASS。
- [ ] **Step 5: 提交** — `git commit -m "feat(work-ui): applyEvent 产物与检查点归约"`

---

### Task 6: selectors

**Files:**
- Create: `ui/src/state/selectors.ts`、`ui/tests/unit/selectors.test.ts`

**Interfaces:**
- Produces:
  - `groupConsecutiveTools(entries: TimelineEntry[]): TimelineEntry[]`（只合并相邻、同名、且都 `ok !== false` 的 tool 条目，合并后 `count` 列入 `summary` 前缀，如 `move ×11`）
  - `filterTimeline(entries: TimelineEntry[], mode: 'key' | 'all'): TimelineEntry[]`（`key` 隐藏 `ok === true` 的 `list`/`read`/`glob`/`grep`）
  - `undoScope(run: RunView): { steps: number; targetTurn: number | null; usable: Bool; reason?: string }`
  - `diffLines(text: string): Array<{ n: number; kind: 'context' | 'add' | 'del'; text: string }>`
  - `runMetrics(runs: RunSummary[]): { tasks: number; inputTokens: number; outputTokens: number; costUsd: number }`

- [ ] **Step 1: 写失败测试**

```ts
it('merges consecutive same-name tools', () => { /* 11 条 move → 1 条，summary 以 'move ×11' 开头 */ })
it('does not merge across a message', () => {})
it('does not merge failed tools', () => {})
it('key mode hides successful reads but keeps writes and failures', () => {})
it('undoScope returns the last recorded turn as target', () => {})
it('undoScope is unusable when there is nothing to undo', () => {
  // turns 只有起始轮次 → usable === false，reason === '没有可撤销的轮次'
})
it('undoScope is unusable and explains pruning', () => {
  // currentTurn - keep 已越过目标 → usable === false，reason 含 '已不在保留范围'
})
it('diffLines numbers additions and deletions', () => {})
it('runMetrics sums usage', () => {})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- tests/unit/selectors.test.ts`。
- [ ] **Step 3: 实现** — 全部纯函数，不读外部状态；`undoScope` 的 `steps` 用「当前轮次 − 最近一个可撤轮次」，永不为 0（为 0 时 `usable = false`）。
- [ ] **Step 4: 跑测试确认通过** — 同上文件 → PASS。
- [ ] **Step 5: 提交** — `git commit -m "feat(work-ui): selector 层"`

---

### Task 7: fixture 生成器与三个真实回放

**Files:**
- Create: `ui/tools/lib/fixture-build.mjs`（纯函数，可被测试 import）、`ui/tools/generate-fixtures.mjs`（CLI 入口）、`ui/tests/unit/generate-fixtures.test.ts`、`ui/src/fixtures/runs/organize-v01.json`、`ui/src/fixtures/runs/csv-sales-analysis-v01.json`、`ui/src/fixtures/runs/research-cited-report-v01.json`

**Interfaces:**
- Produces:
  - `buildFixture(runDir: string): ReplayFixture`（`ReplayFixture` 定义在 `ui/src/bridge/fixture.ts`，见 Task 8）
  - CLI：`node tools/generate-fixtures.mjs [runDir…]`，无参数时扫 `var/runs/*/run.json`
- 约定：`at` 为相对 `run.startedAt` 的毫秒数；`seq` 从 0 连续编号；输出 JSON 键排序、2 空格缩进。

- [ ] **Step 1: 写失败测试**

```ts
it('is byte-identical across two runs', () => {
  // 对同一 runDir 生成两次，readFileSync 后 Buffer.equals 为 true
})
it('orders events by at then original seq', () => {
  // 构造同毫秒三条事件 → 输出 at 单调不减，且 seq 连续
})
it('prefers out/changes.json for the change set', () => {})
it('derives changes from move results when changes.json is absent', () => {})
it('sets changes to null when neither source exists', () => {})
it('marks artifacts truncated above 64 KB', () => {})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- tests/unit/generate-fixtures.test.ts`。
- [ ] **Step 3: 实现** — 读 `run.json`；`user/message → message/user`；`assistant/message → message/assistant/done`，并为每个 `toolCalls[i]` 生成 `tool/started`（`at` 与消息相同）；`tool/result → tool/finished`（`isError → ok:false`，`content` 超过 64 KB 截断）。产物正文从 `run.workspaceRoot` 下的同名文件读，读不到就省略该 key。
- [ ] **Step 4: 生成并提交三个真实 fixture**

```bash
cd products/conatus_work/ui
node tools/generate-fixtures.mjs
npm test -- tests/unit/generate-fixtures.test.ts
```
Expected: 生成 `organize-v01`（优先 `folder-organize-v01` 最近一次成功运行）、`csv-sales-analysis-v01`、`research-cited-report-v01`；测试 PASS。

- [ ] **Step 5: 提交** — `git commit -m "feat(work-ui): fixture 生成器与真实回放数据"`

---

### Task 8: fixture 解析器与四个边界用例

**Files:**
- Create: `ui/src/bridge/fixture.ts`、`ui/src/fixtures/edge/edge-undo-failed.json`、`ui/src/fixtures/edge/edge-redo-pruned.json`、`ui/src/fixtures/edge/edge-checkpoint-gap.json`、`ui/src/fixtures/edge/edge-approval-denied.json`、`ui/src/fixtures/index.ts`、`ui/tests/unit/fixtures.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ReplayFixture {
  schemaVersion: 1
  run: RunSummary & { workspaceRoot: string; synthetic: Bool }
  events: Array<{ seq: number; at: number; type: string; data: unknown }>
  artifacts: ArtifactView[]
  files: Record<string, string>
  changes: ChangeSet | null
  checkpoints: CheckpointView & { startTurn: number }
  scripts?: { undo?: UndoResult; redo?: RedoResult }
}
export function parseFixture(input: unknown): ReplayFixture   // 缺字段抛 FixtureError
export class FixtureError extends Error { readonly field: string }
export interface FixtureEntry { id: string; label: string; synthetic: Bool; load: () => Promise<ReplayFixture> }
export const FIXTURES: FixtureEntry[]
export const DEFAULT_FIXTURE_ID = 'organize-v01'
```

- [ ] **Step 1: 写失败测试**

```ts
it('parses every committed fixture', async () => { /* FIXTURES 全量 load() 不抛 */ })
it('rejects a fixture missing checkpoints', () => {
  expect(() => parseFixture({ schemaVersion: 1 })).toThrow(FixtureError)
})
it('marks edge fixtures synthetic', async () => { /* id 以 edge- 开头 → synthetic === true */ })
it('edge-undo-failed has per-file failures', async () => { /* scripts.undo.failures.length >= 1 */ })
it('edge-redo-pruned returns PRUNED', async () => { /* scripts.redo.code === 'PRUNED' */ })
it('edge-checkpoint-gap records a gap', async () => { /* checkpoints.gaps.length === 1 */ })
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- tests/unit/fixtures.test.ts`。
- [ ] **Step 3: 实现解析器与清单** — 手写守卫（不引 zod）；`FIXTURES` 用 `() => import('./runs/organize-v01.json').then(m => parseFixture(m.default))` 保持按需加载。
- [ ] **Step 4: 手写四个边界 fixture** — 各自的 `run.synthetic = true`，事件 6–15 条即可；`edge-undo-failed` 的两条 failure 路径取真实文件名（`inbox/organized/docx/2026-01/contract-east-01.docx`）。
- [ ] **Step 5: 跑测试确认通过** — Run: `npm test -- tests/unit/fixtures.test.ts` → PASS。
- [ ] **Step 6: 提交** — `git commit -m "feat(work-ui): fixture 解析与边界用例"`

---

### Task 9: Scheduler、ReplayTransport 与确定性

**Files:**
- Create: `ui/src/bridge/scheduler.ts`、`ui/src/bridge/replay-transport.ts`、`ui/tests/unit/replay-determinism.test.ts`

**Interfaces:**
- Produces:

```ts
export interface Scheduler { now(): number; after(ms: number, fn: () => void): () => void }
export const realScheduler: Scheduler
export class ManualScheduler implements Scheduler {
  constructor(startAt?: number)
  now(): number
  after(ms: number, fn: () => void): () => void
  advance(ms: number): void
  pending(): number
}
export function createReplayTransport(fixture: ReplayFixture,
  options?: { scheduler?: Scheduler; speed?: number }): BridgeTransport
```

行为约定：`connect()` 先发 `snapshot`（`at: 0`），再按 `at / speed` 排序后依次发事件；`speed === 0` 时全部同步发完；`speed` 缺省 `1`。fixture 的事件**不存 `runId`**（与 `run.id` 重复），emit 时由 transport 补上 `runId: fixture.run.id`。`undo` 返回 `fixture.scripts?.undo ?? { ok: true, appliedSteps: steps, failures: [] }`，并补发 `undo/finished` 事件；`redo` 同理（代码默认同值）。`startTask` 在 `cardId !== fixture.run.taskId` 时返回 `NOT_FOUND`。`readArtifact` 缺正文时返回 `NOT_FOUND`。

- [ ] **Step 1: 写失败测试**

```ts
it('emits a snapshot before any event', async () => {})
it('fires events in order as time advances', () => {
  // ManualScheduler.advance(5000) 后收到的 seq 单调不减
})
it('speed 0 emits everything synchronously', async () => {})
it('handles non-monotonic at without dropping events', async () => {
  // fixture 内 at: [0, 900, 400] → 三条事件全部收到，按 (at, seq) 排序
})
it('is deterministic across two replays', async () => {
  // 两次回放终态 workbenchState 深度相等，timeline 长度相等
})
it('returns NOT_FOUND for an unknown cardId', async () => {})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- tests/unit/replay-determinism.test.ts`。
- [ ] **Step 3: 实现** — 排序在 `connect()` 内完成一次；`ManualScheduler` 用「时间戳 + 插入序」的最小堆或数组排序，`advance` 循环触发到期回调；`disconnect()` 取消失未触发的计时器。
- [ ] **Step 4: 跑测试确认通过** — 同上文件 → PASS。
- [ ] **Step 5: 提交** — `git commit -m "feat(work-ui): 回放传输与虚拟时钟"`

---

### Task 10: 应用壳、任务列表与 fixture 参数

**Files:**
- Create: `ui/src/app/Shell.tsx`、`ui/src/app/fixture-param.ts`、`ui/src/features/tasks/TaskList.tsx`、`ui/src/state/ui-state.ts`、`ui/src/app/provider.tsx`、`ui/tests/component/shell.test.tsx`
- Modify: `ui/src/app/App.tsx`
- 依赖：`npx shadcn@latest add tabs dialog tooltip scroll-area badge separator --yes`

**Interfaces:**
- Consumes: Task 9 `createReplayTransport`、Task 8 `FIXTURES`。
- Produces: `readFixtureParam(search: string): { fixtureId: string; speed: number }`（缺省 `DEFAULT_FIXTURE_ID` / `1`，`speed` 非法时回退 `1`）；`useWorkbenchStore` / `useUiStore`；`data-testid`：`task-list`、`task-list-empty`、`fixture-error`。

- [ ] **Step 1: 写失败测试**

```tsx
it('renders three panes and the task list', async () => {
  render(<App transport={createReplayTransport(fixtureA, { speed: 0 })} />)
  expect(await screen.findByTestId('task-list')).toBeInTheDocument()
  expect(screen.getByTestId('timeline')).toBeInTheDocument()
  expect(screen.getByTestId('right-pane')).toBeInTheDocument()
})
it('shows an error card for an unknown fixture id', () => { /* fixture-error 含 id */ })
it('shows the empty state when there are no tasks', () => { /* task-list-empty */ })
it('reads fixture and speed from the query string', () => {
  expect(readFixtureParam('?fixture=csv-sales-analysis-v01&speed=0'))
    .toEqual({ fixtureId: 'csv-sales-analysis-v01', speed: 0 })
  expect(readFixtureParam('')).toEqual({ fixtureId: 'organize-v01', speed: 1 })
  expect(readFixtureParam('?speed=abc').speed).toBe(1)
})
it('switches the active task', async () => { /* 点击另一条任务 → 中栏标题变化 */ })
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- tests/component/shell.test.tsx`。
- [ ] **Step 3: 实现** — `App` 接受可选 `transport` prop（测试注入），否则按 URL 参数建 `ReplayTransport`；`provider.tsx` 负责 `connect()`/`subscribe()` 并把事件交给 `useWorkbenchStore.apply`；三栏用 CSS grid（`240px minmax(0,1fr) 380px`），左栏可折叠到 56px。
- [ ] **Step 4: 跑测试确认通过** — 同上文件 → PASS。
- [ ] **Step 5: 提交** — `git commit -m "feat(work-ui): 三栏应用壳与任务列表"`

---

### Task 11: 时间线视图

**Files:**
- Create: `ui/src/features/conversation/Timeline.tsx`、`ui/src/features/conversation/TimelineEntry.tsx`、`ui/src/features/conversation/FilterToggle.tsx`、`ui/tests/component/timeline.test.tsx`
- Modify: `ui/src/app/Shell.tsx`

**Interfaces:**
- Consumes: Task 6 `groupConsecutiveTools` / `filterTimeline`；`useUiStore.filter`、`.expanded: Set<string>`。
- Produces: `data-testid`：`timeline`、`timeline-entry-{kind}`、`tool-group`、`filter-toggle`、`reasoning-toggle`。

- [ ] **Step 1: 写失败测试**

```tsx
it('renders a user entry and an assistant entry', () => {})
it('groups consecutive moves into "move ×11"', () => {
  expect(screen.getByTestId('tool-group')).toHaveTextContent('move ×11')
})
it('expands a tool group on click', async () => { /* 展开后出现 11 条 tool 条目 */ })
it('key filter hides successful reads but keeps failures', async () => {})
it('collapses reasoning by default and expands on click', async () => {})
it('shows an unknown-events badge in dev when the counter is non-zero', () => {
  // import.meta.env.DEV 下，unknownEvents > 0 时角标可见
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- tests/component/timeline.test.tsx`。
- [ ] **Step 3: 实现** — 全部条目左对齐；工具条目单行显示 `name · 参数摘要 · 状态 · 耗时`；`ok === false` 加左侧红边；`reasoning` 用 `<details>` 或受控折叠。
- [ ] **Step 4: 跑测试确认通过** — 同上文件 → PASS。
- [ ] **Step 5: 提交** — `git commit -m "feat(work-ui): 时间线与工具归组"`

---

### Task 12: 产物面板

**Files:**
- Create: `ui/src/features/artifacts/ArtifactPanel.tsx`、`ui/src/features/artifacts/ArtifactPreview.tsx`、`ui/src/features/artifacts/markdown.ts`、`ui/tests/component/artifacts.test.tsx`
- Modify: `ui/src/app/Shell.tsx`

**Interfaces:**
- Consumes: `transport.readArtifact`；`Task 2` 的 `ArtifactView`。
- Produces: `renderMarkdown(text: string): string`（`marked` + `DOMPurify.sanitize`）；`data-testid`：`artifact-list`、`artifact-preview`、`artifact-missing`、`artifact-truncated`、`artifact-sandbox`。

- [ ] **Step 1: 写失败测试**

```tsx
it('lists artifacts with pass marks', () => {})
it('renders markdown headings as real headings', () => { /* <h2>结论</h2> 存在 */ })
it('strips scripts from markdown', () => {
  // renderMarkdown('<img src=x onerror=alert(1)>') 不含 'onerror'
})
it('renders html artifacts inside a locked-down iframe', () => {
  const f = screen.getByTestId('artifact-sandbox') as HTMLIFrameElement
  expect(f.getAttribute('sandbox')).toBe('allow-scripts')
  expect(f.getAttribute('sandbox')).not.toContain('allow-same-origin')
})
it('explains a missing body instead of rendering blank', () => { /* artifact-missing */ })
it('flags truncated content', () => { /* artifact-truncated */ })
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- tests/component/artifacts.test.tsx`。
- [ ] **Step 3: 实现** — 按扩展名分流：`.md → markdown`、`.html → iframe(srcdoc)`、其余纯文本 `<pre>`；正文通过 `useArtifactContent(runId, path)` 拉取，失败落到 `artifact-missing`。
- [ ] **Step 4: 跑测试确认通过** — 同上文件 → PASS。
- [ ] **Step 5: 提交** — `git commit -m "feat(work-ui): 产物列表与预览"`

---

### Task 13: 变更面板与撤销流程

**Files:**
- Create: `ui/src/features/changes/ChangePanel.tsx`、`ui/src/features/changes/DiffView.tsx`、`ui/src/features/changes/UndoDialog.tsx`、`ui/tests/component/changes.test.tsx`
- Modify: `ui/src/app/Shell.tsx`

**Interfaces:**
- Consumes: Task 6 `diffLines` / `undoScope`；`transport.undo`。
- Produces: `data-testid`：`change-summary`、`diff-view`、`undo-button`、`undo-dialog`、`undo-failure-list`、`undo-pruned`。

- [ ] **Step 1: 写失败测试**

```tsx
it('shows the change summary and file count', () => {
  expect(screen.getByTestId('change-summary')).toHaveTextContent('11')
})
it('renders unified diff with +/- coloring', () => { /* 至少一行 add、一行 del */ })
it('disables undo when there is nothing to undo', () => {
  expect(screen.getByTestId('undo-button')).toBeDisabled()
})
it('confirms with round, target turn and file count before undo', async () => {
  // 弹窗文案含 '回退到轮次' 与 '涉及'
})
it('lists per-file failures after a failed undo', async () => { /* undo-failure-list 有 2 行 */ })
it('explains a pruned redo instead of silently failing', async () => { /* undo-pruned */ })
it('shows an explicit message when changes are null', () => { /* '该运行未记录变更' */ })
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- tests/component/changes.test.tsx`。
- [ ] **Step 3: 实现** — 撤销成功后中栏追加可见提示；失败时在弹窗内渲染 failure 列表 + `重试` / `保留现状`；`PRUNED` 走独立文案。
- [ ] **Step 4: 跑测试确认通过** — 同上文件 → PASS。
- [ ] **Step 5: 提交** — `git commit -m "feat(work-ui): 变更面板与撤销流程"`

---

### Task 14: 检查点、审批、设置与快捷键

**Files:**
- Create: `ui/src/features/checkpoints/CheckpointPanel.tsx`、`ui/src/features/approval/ApprovalBar.tsx`、`ui/src/features/conversation/Composer.tsx`、`ui/src/features/settings/SettingsPage.tsx`、`ui/src/features/tasks/CommandPalette.tsx`、`ui/tests/component/approval.test.tsx`
- Modify: `ui/src/app/Shell.tsx`

**Interfaces:**
- Produces: `data-testid`：`checkpoint-list`、`checkpoint-gap-banner`、`approval-bar`、`composer`、`command-palette`。

- [ ] **Step 1: 写失败测试**

```tsx
it('lists turns and greys out pruned ones', () => { /* 超出保留范围的轮次带 disabled 标记 */ })
it('shows a banner when checkpoint gaps exist', () => { /* checkpoint-gap-banner 文案含 '空洞' */ })
it('disables the composer while approval is pending', () => {})
it('records the deny decision in the timeline', async () => {
  // 点 '拒绝' → 时间线出现 approval 条目，decision === 'deny'
})
it('opens the command palette with cmd+k', async () => {})
it('explains that a finished replay will not execute new messages', async () => {
  // status === 'succeeded' 时 composer 下方出现「回放已结束」提示
})
it('opens the undo dialog with cmd+z instead of undoing directly', async () => {
  // transport.undo 未被调用
})
it('renders the three settings fields read-only', () => { /* 模型 / 工作区 / 保留轮次 */ })
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- tests/component/approval.test.tsx`。
- [ ] **Step 3: 实现** — 快捷键挂在 `Shell` 的 `keydown`，`metaKey || ctrlKey`；`⌘K` 用 shadcn `Command`；设置页三项只读，值来自 fixture `run` 与 `checkpoints.keep`。
- [ ] **Step 4: 跑测试确认通过** — 同上文件 → PASS。
- [ ] **Step 5: 提交** — `git commit -m "feat(work-ui): 检查点、审批、设置与快捷键"`

---

### Task 15: e2e 与构建自包含

**Files:**
- Create: `ui/tests/e2e/replay.spec.ts`、`ui/tests/e2e/edge.spec.ts`
- Modify: `ui/README.md`

**Interfaces:**
- Consumes: `?fixture=<id>&speed=0` 与 Task 10–14 的 `data-testid`。

- [ ] **Step 1: 写失败的 e2e**

```ts
test('organize replay shows artifacts, 11 changes and undo', async ({ page }) => {
  await page.goto('/?fixture=organize-v01&speed=0')
  await expect(page.getByTestId('change-summary')).toContainText('11')
  await expect(page.getByTestId('artifact-list').getByRole('listitem')).toHaveCount(2)
  await expect(page.getByTestId('undo-button')).toBeEnabled()
})
test('csv replay renders its chart artifact', async ({ page }) => { /* 产物数 >= 2，预览非空 */ })
test('research replay shows a long timeline', async ({ page }) => { /* 条目数 > 20 */ })
```

`edge.spec.ts` 四条：撤销失败列表、redo 被裁剪、轮次洞黄条、审批拒绝记录。

- [ ] **Step 2: 跑 e2e 确认失败** — Run: `npm run build && npm run e2e`，Expected: 选择器或行为缺失导致失败。
- [ ] **Step 3: 补齐缺口** — 只补选择器、等待条件与缺失的边界渲染，不改业务逻辑。
- [ ] **Step 4: 跑 e2e 确认通过** — Run: `npm run e2e` → 7 passed。
- [ ] **Step 5: 验证构建自包含**

```bash
npm run build
grep -rE "https?://(?!localhost)" dist --include="*.js" --include="*.css" | grep -v "sourceMappingURL" || echo "no external urls"
```
Expected: 无外部 `http(s)` 引用（React 警告文案里的 URL 链接除外，需人工确认那几条不是资源加载）。

- [ ] **Step 6: 更新 `ui/README.md`** — 写清 `npm install` / `generate-fixtures` / `dev` / `test` / `e2e` 与 URL 参数。
- [ ] **Step 7: 提交** — `git commit -m "test(work-ui): 回放与边界 e2e"`

---

## 自检记录

- spec 第 4 节每条命令/事件都有任务承接（命令在 Task 9/13/14 接线，事件在 Task 3–5 归约）。
- spec 第 9 节验收五条分别由 Task 10（三 fixture 切换）、Task 12（预览与缺失）、Task 13（撤销两条路径）、Task 6（`unknownEvents` 由 Task 3 计数并在 Task 11 展示）、Task 9（确定性）覆盖。
- 类型名在 Task 2 一次定义，后续任务只引用，不重复声明。
- Review Focus 五条分别落在 Task 3（重复 seq）、Task 9（非单调 `at`）、Task 12（HTML 隔离）、Task 6 + 13（`steps = 0` / 裁剪）、Task 12 + 13（缺失字段）。
