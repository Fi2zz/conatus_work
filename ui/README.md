# conatus_work/ui

Conatus 桌面工作台的 React 界面。数据来自 `src/fixtures/` 里已提交的桥接事件流，
不依赖 Flutter、不依赖网络，也不依赖本机 `var/runs`。

## 开发

```bash
npm install
npm run dev
```

默认加载 `organize-v01` 回放。URL 参数：

- `?fixture=<id>`：切换回放数据
- `?speed=<n>`：回放倍速，`0` 表示直接到终态；小于 `1` 会放慢，便于观察运行中状态

界面操作：

- 任务头在运行中显示「停止」（中断回放、状态转 `aborted`），失败/中断后显示「重试」（同一 fixture 另起一条 run）
- 左栏 `«` 折叠成 56px 轨道；中/右栏之间的分隔条可拖拽（320–560px），双击复位 380px
- `⌘K` 切任务，`⌘Z` 打开撤销确认（不直接执行）

可用 fixture：

| id | 来源 | 用途 |
|---|---|---|
| `organize-v01` | 真实运行 | 主回放：10 移动 + 1 冲突，2 个产物，可撤销 |
| `csv-sales-analysis-v01` | 真实运行 | 3 个产物（含 SVG 图表） |
| `research-cited-report-v01` | 真实运行 | 长文本、多工具、长耗时 |
| `edge-undo-failed` | 合成 | 撤销逐文件失败 |
| `edge-redo-pruned` | 合成 | 重做目标已被裁剪（`PRUNED`） |
| `edge-checkpoint-gap` | 合成 | 检查点轮次洞 |
| `edge-approval-denied` | 合成 | 审批拒绝后的事件记录 |
| `edge-failure-run` | 合成 | 失败运行的错误视图与重试入口 |

回放模式下发送框禁用并标注原因；真实宿主（`mode: 'host'`）发送失败时保留草稿并在
输入框上方显示错误，审批提交失败时保留审批条并显示错误。

产物预览：Markdown / HTML（sandbox iframe）/ 图片 / PDF / JSON / 纯文本，CSV 与 TSV
渲染为表格；DOCX / XLSX / PPTX 等二进制给出明确说明，并提供「在 Finder 中显示」。
时间线用 `content-visibility` 跳过视口外的行，长任务不会一次性绘制全部条目。

## 测试

```bash
npm test          # Vitest：reducer / selector / 组件 / 确定性
npm run e2e       # Playwright：4 条真实回放 + 4 条边界（需先 npm run build）
npm run lint      # tsc --noEmit
```

## 从真实运行记录重新生成 fixture

```bash
node tools/generate-fixtures.mjs
```

读 `../var/runs/*/run.json` 与同目录 `events.jsonl`，输出到 `src/fixtures/runs/`。
生成器幂等，同输入两次运行输出逐字节相同；优先选「产物仍留在工作区」的运行，
否则正文不可预览。边界 fixture 是手写的（`src/fixtures/edge/`），不由脚本生成。

## 接真实宿主（WebView）

`src/bridge/webview-transport.ts` 是 `BridgeTransport` 的 postMessage 实现：

```ts
import { createWebViewTransport } from '@/bridge/webview-transport'

const transport = createWebViewTransport()   // 走 window.parent / WebView2 通道
```

- 信封：`{v:1, kind:'hello'|'command'|'result'|'event', id, command, payload}`
- 只接收来自 parent 的消息；坏帧丢弃；请求按 `id` 配对，10s 超时回错误
- `openTask` 拿到 fixture 后用 `applyEvent` 折叠成 `RunView`，不重写投影
- `message.send` / `approval.respond` 已按契约发送；逻辑侧要补的两条命令见
  `../docs/2026-11-04-ui-shell-handoff.md`

## 结构

- `src/bridge/`：命令 / 事件契约（`types.ts`、`events.ts`）、transport 与回放实现
- `src/state/`：`applyEvent` 纯 reducer、selector、UI 状态
- `src/features/`：任务、时间线、产物、变更、检查点、审批、设置
- `src/fixtures/`：已提交的回放数据
