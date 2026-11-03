import type { BridgeEvent } from '@/bridge/events'
import type { WorkbenchState } from '@/bridge/types'

import { applyCheckpoint, applyArtifact, applyChanges } from './apply-artifacts'
import {
  applyApprovalRequested,
  applyPlan,
  applySnapshot,
  applyTaskEnded,
  applyTaskStarted,
  applyTaskStatus,
  applyUsage,
} from './apply-lifecycle'
import {
  applyApprovalResolved,
  applyAssistantDelta,
  applyAssistantDone,
  applyRedoFinished,
  applyToolFinished,
  applyToolStarted,
  applyUndoFinished,
  applyUserMessage,
} from './apply-timeline'
import { scopeOf } from './event-helpers'

export function applyEvent(state: WorkbenchState, event: BridgeEvent): WorkbenchState {
  // snapshot 是幂等合并，允许重连时重发；其余事件按 (runId, seq) 去重。
  const replayable = event.type !== 'snapshot'
  const seenKey = `${scopeOf(event)}:${event.seq}`
  if (replayable && state.seenSeqs[seenKey]) return state
  const marked: WorkbenchState = replayable
    ? { ...state, seenSeqs: { ...state.seenSeqs, [seenKey]: true } }
    : state

  switch (event.type) {
    case 'snapshot':
      return applySnapshot(marked, event)
    case 'task/started':
      return applyTaskStarted(marked, event)
    case 'task/status':
      return applyTaskStatus(marked, event)
    case 'task/ended':
      return applyTaskEnded(marked, event)
    case 'usage/updated':
      return applyUsage(marked, event)
    case 'plan/updated':
      return applyPlan(marked, event)
    case 'approval/requested':
      return applyApprovalRequested(marked, event)
    case 'message/user':
      return applyUserMessage(marked, event)
    case 'message/assistant/delta':
      return applyAssistantDelta(marked, event)
    case 'message/assistant/done':
      return applyAssistantDone(marked, event)
    case 'tool/started':
      return applyToolStarted(marked, event)
    case 'tool/finished':
      return applyToolFinished(marked, event)
    case 'approval/resolved':
      return applyApprovalResolved(marked, event)
    case 'undo/started':
      return marked
    case 'undo/finished':
      return applyUndoFinished(marked, event)
    case 'redo/finished':
      return applyRedoFinished(marked, event)
    case 'artifact/added':
    case 'artifact/updated':
      return applyArtifact(marked, event)
    case 'changes/updated':
      return applyChanges(marked, event)
    case 'checkpoint/recorded':
      return applyCheckpoint(marked, event)
    default:
      return { ...marked, unknownEvents: marked.unknownEvents + 1 }
  }
}
