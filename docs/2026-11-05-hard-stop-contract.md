# 硬停止契约与 worker 进程方案（2026-11-05）

## 一、为什么现在不能真正硬停

任务在壳进程内跑：`TaskService.start` 直接 `unawaited(_execute(...))` 调用 `Runner.run`，
`run.json` 里的 `pid` 就是壳进程自己。`task.cancel` 只能做协作式取消：

1. 写 `abort.request`
2. 关闭在途模型请求
3. Agent 每 120ms 轮询标志
4. 如果卡在搜索 / 抓取 / shell 子进程里，它不检查标志，就只能等

所以不能直接 `kill(record.pid)`，那会把整个 App 杀掉。

## 二、UI 已经做的部分

- 点「停止」立即把运行标记为 `aborted`，不再等 `task/ended`
- 如果宿主迟迟没有收尾（`endedAt` 为空），任务头出现「强制停止」
- 「强制停止」调用 `task.kill`；成功后在本地补 `endedAt`，按钮消失
- 宿主未实现 `task.kill` 时显示明确错误，不静默
- 回放模式不显示强制停止

## 三、`task.kill` 契约

请求：

```json
{ "runId": "run_…" }
```

成功：

```json
{ "ok": true, "value": { "status": "aborted" } }
```

失败：`NOT_FOUND` / `INTERNAL`，`message` 说明原因。

宿主必须保证：

1. 终止该 run 的执行体（进程或隔离单元）
2. 把 `run.json.status` 落盘为 `aborted`，写 `endedAt`
3. 推一帧 `task/ended`（`status: aborted`）并关闭事件流
4. 清理该 run 的临时资源；不要误杀其他 run
5. 强杀后不假装成功：没有最终检查点时，撤销只能回到上一个完整检查点

## 四、推荐实现：每个任务一个 worker 进程

```text
Flutter Shell
└─ TaskService
   ├─ spawn: runner worker run <cardId> --run <runId>
   ├─ tail: var/runs/<runId>/events.jsonl
   └─ cancel/kill:
        写 abort.request
        → 2s 宽限
        → SIGTERM
        → 2s
        → SIGKILL
```

### 需要补的命令

- `runner worker run <cardId> --run <runId>`：只跑一次任务，stdout 只输出事件
- `runner worker continue <runId> --text <text>`：续写；或者每个 run 保持一个常驻 worker
- 审批：worker 把 `approval/requested` 写到事件文件，宿主写回 `approval.response` 文件；
  或走 stdin/stdout JSON 行
- `events.jsonl` 仍是唯一事件源，UI 不需要改协议

### 数据一致性

- SIGKILL 可能跳过最终 `recordTurn`，`run.json` 可能仍是 `running`
- 启动时对账：`status=running && !pidAlive(pid)` → 标 `aborted`，写 `endedAt`
- 强制停止后保留最后一份完整检查点，撤销范围按它计算
- 不要删除工作区；用户可以用 `undo` / 手动恢复

## 五、先做哪一步

1. **协作式取消补完整（不改进程模型）**
   - 工具调用前检查 `AbortSignal`
   - 搜索 / 抓取按 run 持有 client，取消时关闭
   - Shell 工具记录 pid，取消时杀进程组
   - `task.cancel` 立即回 `aborted` 并推 `task/ended`
   - 启动对账僵尸 `running`
2. **再上 worker 进程**
   - `task.kill` 真正 SIGTERM/SIGKILL
   - 这一步完成后，UI 的「强制停止」才从“契约可用”变成“真的能杀”

## 六、验收

- 搜索 / 抓取卡住时，`task.cancel` 2 秒内让 UI 收敛到 `aborted`
- `task.kill` 后 worker 进程不存在，`run.json` 为 `aborted`
- 强杀不误伤其他 run，不留下 `running` 僵尸
- 强制停止后 `undo` 仍能回到上一个完整检查点
