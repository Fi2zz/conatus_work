import type { BridgeEvent } from '@/bridge/events'
import type { RunSummary, RunView, WorkbenchState } from '@/bridge/types'

import { runFromSummary } from './workbench-state'

function sortOrder(runs: Record<string, RunView>): string[] {
  return Object.values(runs)
    .sort((left, right) => {
      if (left.startedAt === right.startedAt) return left.id.localeCompare(right.id)
      return left.startedAt < right.startedAt ? 1 : -1
    })
    .map((run) => run.id)
}

function withRun(
  state: WorkbenchState,
  runId: string,
  update: (run: RunView) => RunView,
  seed?: RunSummary,
): WorkbenchState {
  const existing = state.runs[runId]
  if (!existing && !seed) return state
  const base = existing ?? runFromSummary(seed as RunSummary)
  const runs = { ...state.runs, [runId]: update(base) }
  return { ...state, runs, order: sortOrder(runs) }
}

function applySnapshot(state: WorkbenchState, event: Extract<BridgeEvent, { type: 'snapshot' }>): WorkbenchState {
  const runs: Record<string, RunView> = { ...state.runs }
  for (const summary of event.data.runs) {
    const existing = runs[summary.id]
    runs[summary.id] = existing
      ? { ...existing, ...summary, timeline: existing.timeline, artifacts: existing.artifacts }
      : runFromSummary(summary)
  }
  const order = sortOrder(runs)
  const activeRunId = event.data.activeRunId ?? state.activeRunId ?? order[0] ?? null
  return { ...state, runs, order, activeRunId }
}

function scopeOf(event: BridgeEvent): string {
  return event.type === 'snapshot' ? 'snapshot' : event.runId
}

export function applyEvent(state: WorkbenchState, event: BridgeEvent): WorkbenchState {
  const seenKey = `${scopeOf(event)}:${event.seq}`
  if (state.seenSeqs[seenKey]) return state
  const marked: WorkbenchState = { ...state, seenSeqs: { ...state.seenSeqs, [seenKey]: true } }

  switch (event.type) {
    case 'snapshot':
      return applySnapshot(marked, event)

    case 'task/started':
      return withRun(
        marked,
        event.runId,
        (run) => ({ ...run, ...event.data, status: 'running' }),
        {
          id: event.runId,
          ...event.data,
          status: 'running',
          startedAt: event.data.startedAt,
          usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
        },
      )

    case 'task/status':
      return withRun(marked, event.runId, (run) => ({ ...run, status: event.data.status }))

    case 'task/ended':
      return withRun(marked, event.runId, (run) => ({
        ...run,
        status: event.data.status,
        endedAt: event.data.endedAt,
      }))

    case 'usage/updated':
      return withRun(marked, event.runId, (run) => ({ ...run, usage: event.data }))

    case 'undo/started':
      return marked

    default:
      return { ...marked, unknownEvents: marked.unknownEvents + 1 }
  }
}
