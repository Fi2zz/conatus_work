# conatus_work/ui

Conatus 桌面工作台的 React 界面。数据来自 `src/fixtures/` 里已提交的桥接事件流，
不依赖 Flutter、不依赖网络，也不依赖本机 `var/runs`。

## 开发

```bash
npm install
npm run dev
```

默认加载 `organize-v01` 回放。URL 参数：

- `?fixture=<id>`：切换回放数据（见 `src/fixtures/index.ts`）
- `?speed=<n>`：回放倍速，`0` 表示直接到终态

## 测试

```bash
npm test          # Vitest：reducer / selector / 组件 / 确定性
npm run e2e       # Playwright：回放与边界（需先 npm run build）
npm run lint      # tsc --noEmit
```

## 从真实运行记录重新生成 fixture

```bash
node tools/generate-fixtures.mjs
```

读 `../var/runs/*/run.json` 与同目录 `events.jsonl`，输出到 `src/fixtures/runs/`。
生成器幂等，同输入两次运行输出逐字节相同。跑 e2e 前需要 `npm run build`。
