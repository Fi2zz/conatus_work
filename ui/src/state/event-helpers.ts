import type { BridgeEvent } from '@/bridge/events'
import type { RunSummary, RunView, TimelineEntry, WorkbenchState } from '@/bridge/types'

import { runFromSummary } from './workbench-state'

export function sortOrder(runs: Record<string, RunView>): string[] {
  return Object.values(runs)
    .sort((left, right) => {
      const leftAt = Date.parse(left.startedAt)
      const rightAt = Date.parse(right.startedAt)
      if (leftAt === rightAt || Number.isNaN(leftAt) || Number.isNaN(rightAt)) {
        if (left.startedAt === right.startedAt) return left.id.localeCompare(right.id)
        return left.startedAt < right.startedAt ? 1 : -1
      }
      return rightAt - leftAt
    })
    .map((run) => run.id)
}

export function withRun(
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

export function replaceEntry(
  run: RunView,
  match: (entry: TimelineEntry) => boolean,
  update: (entry: TimelineEntry) => TimelineEntry,
  fallback: () => TimelineEntry,
): RunView {
  const index = run.timeline.findIndex(match)
  if (index < 0) return { ...run, timeline: [...run.timeline, fallback()] }
  const timeline = [...run.timeline]
  timeline[index] = update(timeline[index])
  return { ...run, timeline }
}

export function scopeOf(event: BridgeEvent): string {
  return event.type === 'snapshot' ? 'snapshot' : event.runId
}
