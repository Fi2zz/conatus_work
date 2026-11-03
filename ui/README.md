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
- `?speed=<n>`：回放倍速，`0` 表示直接到终态

可用 fixture：

| id | 来源 | 用途 |
|---|---|---|
| `organize-v01` | 真实运行 | 主回放：10 移动 + 1 冲突，2 个产物，可撤销 |
| `csv-sales-analysis-v01` | 真实运行 | 3 个产物（含图表 HTML） |
| `research-cited-report-v01` | 真实运行 | 长文本、多工具、长耗时 |
| `edge-undo-failed` | 合成 | 撤销逐文件失败 |
| `edge-redo-pruned` | 合成 | 重做目标已被裁剪（`PRUNED`） |
| `edge-checkpoint-gap` | 合成 | 检查点轮次洞 |
| `edge-approval-denied` | 合成 | 审批拒绝后的事件记录 |

## 测试

```bash
npm test          # Vitest：reducer / selector / 组件 / 确定性
npm run e2e       # Playwright：3 条真实回放 + 4 条边界（需先 npm run build）
npm run lint      # tsc --noEmit
```

## 从真实运行记录重新生成 fixture

```bash
node tools/generate-fixtures.mjs
```

读 `../var/runs/*/run.json` 与同目录 `events.jsonl`，输出到 `src/fixtures/runs/`。
生成器幂等，同输入两次运行输出逐字节相同；优先选「产物仍留在工作区」的运行，
否则正文不可预览。边界 fixture 是手写的（`src/fixtures/edge/`），不由脚本生成。

## 结构

- `src/bridge/`：命令 / 事件契约（`types.ts`、`events.ts`）、transport 与回放实现
- `src/state/`：`applyEvent` 纯 reducer、selector、UI 状态
- `src/features/`：任务、时间线、产物、变更、检查点、审批、设置
- `src/fixtures/`：已提交的回放数据
