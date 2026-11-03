import type { CheckpointView, RunSummary, RunView, WorkbenchState } from '@/bridge/types'

export const emptyCheckpoints: CheckpointView = {
  currentTurn: 0,
  startTurn: 0,
  keep: 5,
  turns: [],
  gaps: [],
}

export function runFromSummary(summary: RunSummary): RunView {
  return {
    id: summary.id,
    taskId: summary.taskId,
    title: summary.title,
    chain: summary.chain,
    status: summary.status,
    model: summary.model,
    startedAt: summary.startedAt,
    endedAt: summary.endedAt,
    usage: summary.usage,
    synthetic: summary.synthetic,
    timeline: [],
    artifacts: [],
    changes: null,
    checkpoints: { ...emptyCheckpoints },
  }
}

export const initialWorkbenchState: WorkbenchState = {
  runs: {},
  order: [],
  activeRunId: null,
  unknownEvents: 0,
  seenSeqs: {},
}
