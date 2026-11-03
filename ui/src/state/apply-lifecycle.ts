import type { BridgeEvent } from '@/bridge/events'
import type { RunView, WorkbenchState } from '@/bridge/types'

import { runFromSummary } from './workbench-state'
import { sortOrder, withRun } from './event-helpers'

export function applySnapshot(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'snapshot' }>,
): WorkbenchState {
  const runs: Record<string, RunView> = { ...state.runs }
  for (const summary of event.data.runs) {
    const existing = runs[summary.id]
    const seeded = event.data.checkpoints?.[summary.id]
    if (!existing) {
      runs[summary.id] = { ...runFromSummary(summary), checkpoints: seeded ?? runFromSummary(summary).checkpoints }
      continue
    }
    runs[summary.id] = {
      ...existing,
      ...summary,
      timeline: existing.timeline,
      artifacts: existing.artifacts,
      checkpoints: seeded
        ? {
            ...seeded,
            turns: existing.checkpoints.turns,
            currentTurn: existing.checkpoints.currentTurn,
            gaps: existing.checkpoints.gaps,
          }
        : existing.checkpoints,
    }
  }
  const order = sortOrder(runs)
  const activeRunId = event.data.activeRunId ?? state.activeRunId ?? order[0] ?? null
  return { ...state, runs, order, activeRunId }
}

export function applyTaskStarted(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'task/started' }>,
): WorkbenchState {
  return withRun(
    state,
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
}

export function applyTaskStatus(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'task/status' }>,
): WorkbenchState {
  return withRun(state, event.runId, (run) => ({ ...run, status: event.data.status }))
}

export function applyTaskEnded(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'task/ended' }>,
): WorkbenchState {
  return withRun(state, event.runId, (run) => ({
    ...run,
    status: event.data.status,
    endedAt: event.data.endedAt,
    timeline:
      event.data.failure.category || event.data.failure.message
        ? [
            ...run.timeline,
            {
              kind: 'status',
              id: `status-${run.id}-${event.seq}`,
              at: event.at,
              status: event.data.status,
              text: event.data.failure.message ?? event.data.failure.category ?? undefined,
            },
          ]
        : run.timeline,
  }))
}

export function applyUsage(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'usage/updated' }>,
): WorkbenchState {
  return withRun(state, event.runId, (run) => ({ ...run, usage: event.data }))
}

export function applyPlan(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'plan/updated' }>,
): WorkbenchState {
  return withRun(state, event.runId, (run) => ({ ...run, plan: event.data.items }))
}

export function applyApprovalRequested(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'approval/requested' }>,
): WorkbenchState {
  return withRun(state, event.runId, (run) => ({ ...run, approval: event.data }))
}
