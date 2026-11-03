import type { BridgeEvent } from '@/bridge/events'
import type { RunSummary, Usage } from '@/bridge/types'

export const usage = (cost = 0.01): Usage => ({ inputTokens: 100, outputTokens: 50, costUsd: cost })

export const summary = (over: Partial<RunSummary> = {}): RunSummary => ({
  id: 'run-a',
  taskId: 'task-a',
  title: '任务 A',
  chain: 'organize',
  status: 'succeeded',
  model: 'test/model',
  startedAt: '2026-11-03T10:00:00+08:00',
  usage: usage(),
  ...over,
})

export const runA = summary({ id: 'run-a', startedAt: '2026-11-03T10:00:00+08:00' })
export const runB = summary({ id: 'run-b', title: '任务 B', startedAt: '2026-11-03T11:00:00+08:00' })

export const snapshotEvent = (
  runs: RunSummary[],
  activeRunId: string | null,
  seq = 0,
): BridgeEvent => ({ seq, at: 0, type: 'snapshot', data: { runs, activeRunId } })

export const userMessageEvent = (seq: number, runId = 'run-a', text = '你好'): BridgeEvent => ({
  seq,
  at: 1000,
  type: 'message/user',
  runId,
  data: { text },
})
