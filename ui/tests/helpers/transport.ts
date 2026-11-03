import type { BridgeEvent } from '@/bridge/events'
import type { BridgeTransport } from '@/bridge/transport'
import type { CommandResult, RunStatus, RunSummary, RunView, Usage } from '@/bridge/types'

const usage: Usage = { inputTokens: 10, outputTokens: 5, costUsd: 0.001 }

export function summaryOf(over: Partial<RunSummary> = {}): RunSummary {
  return {
    id: 'run-a',
    taskId: 'task-a',
    title: '任务 A',
    chain: 'organize',
    status: 'succeeded',
    model: 'test/model',
    startedAt: '2026-11-03T10:00:00+08:00',
    usage,
    ...over,
  }
}

const ok = <T,>(value: T): CommandResult<T> => ({ ok: true, value })

export function createStubTransport(runs: RunSummary[], activeRunId: string | null = runs[0]?.id ?? null): BridgeTransport {
  const listeners = new Set<(event: BridgeEvent) => void>()
  return {
    async connect() {
      const event: BridgeEvent = { seq: -1, at: 0, type: 'snapshot', data: { runs, activeRunId } }
      for (const listener of listeners) listener(event)
    },
    disconnect() {
      listeners.clear()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async listTasks() {
      return ok(runs)
    },
    async openTask(runId) {
      return ok({ id: runId } as RunView)
    },
    async startTask() {
      return ok({ runId: runs[0]?.id ?? '' })
    },
    async cancelTask() {
      return ok({ status: 'aborted' as RunStatus })
    },
    async sendMessage() {
      return ok(undefined)
    },
    async respondApproval() {
      return ok(undefined)
    },
    async openDiff() {
      return { ok: false, error: { code: 'NOT_FOUND', message: '合成' } }
    },
    async undo() {
      return ok({ ok: true, appliedSteps: 1, failures: [] })
    },
    async redo() {
      return ok({ ok: true, appliedSteps: 1 })
    },
    async readArtifact() {
      return { ok: false, error: { code: 'NOT_FOUND', message: '合成' } }
    },
  }
}
