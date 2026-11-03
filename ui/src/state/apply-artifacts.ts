import type { BridgeEvent } from '@/bridge/events'
import type { WorkbenchState } from '@/bridge/types'

import { withRun } from './event-helpers'

export function applyArtifact(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'artifact/added' | 'artifact/updated' }>,
): WorkbenchState {
  return withRun(state, event.runId, (run) => {
    const index = run.artifacts.findIndex((item) => item.path === event.data.path)
    if (index < 0) return { ...run, artifacts: [...run.artifacts, event.data] }
    const artifacts = [...run.artifacts]
    artifacts[index] = event.data
    return { ...run, artifacts }
  })
}

export function applyChanges(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'changes/updated' }>,
): WorkbenchState {
  return withRun(state, event.runId, (run) => ({ ...run, changes: event.data }))
}

export function applyCheckpoint(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'checkpoint/recorded' }>,
): WorkbenchState {
  return withRun(state, event.runId, (run) => {
    const known = run.checkpoints.turns.map((turn) => turn.turn)
    const previous = known.length > 0 ? Math.max(...known) : null
    const gaps = [...run.checkpoints.gaps]
    if (previous !== null) {
      for (let turn = previous + 1; turn < event.data.turn; turn += 1) {
        if (!gaps.includes(turn)) gaps.push(turn)
      }
    }
    const turns = known.includes(event.data.turn)
      ? run.checkpoints.turns
      : [...run.checkpoints.turns, { turn: event.data.turn, at: event.data.at, eventCount: event.data.eventCount }]
    return {
      ...run,
      checkpoints: {
        ...run.checkpoints,
        turns,
        gaps,
        startTurn: event.data.startTurn ?? run.checkpoints.startTurn,
        currentTurn: Math.max(run.checkpoints.currentTurn, event.data.turn),
      },
    }
  })
}
