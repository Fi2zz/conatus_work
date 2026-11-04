# UI / 壳侧交接：消息发送与审批（2026-11-04）

本文件记录 UI / 壳与逻辑侧的接口。`message.send` 与 `approval.respond` 已于
2026-11-04 在 Dart 侧落地，UI 已按契约适配；保留下面的请求/事件说明作为回归依据。

## 一、UI / 壳侧已完成

- `ui/src/bridge/webview-transport.ts` 已真正发送 `message.send` 与 `approval.respond`，
  `mode: 'host'`；回放传输为 `mode: 'replay'`。
- 发送失败时**保留输入草稿**并显示 `composer-error`；审批提交失败时保留审批条并显示
  `approval-error`。不再静默丢消息。
- 回放模式下发送框禁用，并提示「回放模式 / 回放已结束，发送消息不会被执行」。
- 真实宿主运行中只显示「停止」；任务结束后输入框提示「发送消息会继续该会话」。
  这与 Dart 侧「运行中发送回 `DENIED`」的行为一致。
- 壳 `shell/lib/asset_server.dart` 已加 CSP（`default-src 'self'`、`object-src 'none'`、
  `frame-ancestors 'none'` 等）与 `nosniff` / `no-referrer`。
- UI 的 Vitest 与 Playwright 已进 `.github/workflows/test.yml`。
- 产物预览：CSV / TSV 渲染为表格；DOCX / XLSX / PPTX 等二进制给出明确说明并保留
  「在 Finder 中显示」。

## 二、逻辑侧已实现的命令（UI 已适配）

信封不变：`{v:1, kind:'command', id, command, payload}`。

### 2.1 `message.send`

请求：

```json
{ "runId": "run_…", "text": "继续整理剩下的一半" }
```

成功：`{ "ok": true }`（无 `value` 即可）。

失败：`{ "ok": false, "error": { "code": "NOT_FOUND | PRUNED | DENIED | INTERNAL", "message": "…" } }`。

行为要求（Dart 侧已满足）：

1. 把 `text` 作为新的 user 回合追加到该 run 的会话，继续 Agent Loop；不要新建 run。
2. 事件顺序至少：`message/user` → `message/assistant/delta`* → `message/assistant/done`
   → 工具事件 → `usage/updated` → `checkpoint/recorded`（如产生新轮次）→
   `task/status` / `task/ended`。
3. 运行仍在执行时返回 `DENIED`（「该运行仍在执行，先停止再发送」）；UI 运行中只显示停止。
4. 运行已结束（`succeeded` / `failed` / `aborted`）时允许继续；UI 仅在回放模式禁用。
4. 会话不可恢复、模型未配置、运行记录缺失时返回明确错误，**不要返回 ok 后什么都不做**。
5. 与现有 `task.cancel` 的取消语义兼容：在途 `message.send` 被取消时回 `INTERNAL` 或
   `DENIED`，由 UI 提示。

### 2.2 `approval.respond`

请求：

```json
{ "requestId": "req-…", "decision": "allow" | "deny" }
```

成功：`{ "ok": true }`。

失败：`DENIED`（已过期 / 已被其他决策处理）、`NOT_FOUND`（未知 requestId）、
`INTERNAL`（宿主未接线）。

前提：**运行器目前没有审批源**。需要先装配风险守卫 / 审批回调，让真实运行能推送
`approval/requested`；否则界面只能在 fixture 里看到审批条。决策到达后：

1. 恢复被挂起的工具调用（allow）或按拒绝路径收口（deny）；
2. 推送 `approval/resolved`（`{ requestId, name, decision }`），时间线会追加审计条目；
3. 清除 `run.approval`，让 composer 重新可用。

## 三、壳侧无需再改

`shell/lib/channel.dart` 把每条命令转给 `BridgeHost.dispatch`，`host.dart` 只需补两个
`case`。`message.send` 的增量事件通过现有 `push` 回调即可送达 React。

## 四、验证入口

```bash
cd products/conatus_work/ui
npm run lint && npm test

cd ../shell
flutter test

# 逻辑侧补完后，建议再加一条走真实宿主的 e2e：
# 发送一句话 → 时间线出现 user 条目 → 出现 assistant 增量 → 状态收敛。
```

相关 UI 用例：

- `ui/tests/unit/webview-transport.test.ts`：两个命令的 payload 与错误透传。
- `ui/tests/component/controls.test.tsx`：发送成功清草稿；失败保留草稿并提示；回放禁用。
- `ui/tests/component/approval.test.tsx`：审批失败提示且审批条不消失。
