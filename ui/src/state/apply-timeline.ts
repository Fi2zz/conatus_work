import type { BridgeEvent } from '@/bridge/events'
import type { WorkbenchState } from '@/bridge/types'

import { replaceEntry, withRun } from './event-helpers'

export function applyUserMessage(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'message/user' }>,
): WorkbenchState {
  return withRun(state, event.runId, (run) => ({
    ...run,
    timeline: [
      ...run.timeline,
      { kind: 'user', id: `${event.runId}-${event.seq}`, at: event.at, text: event.data.text },
    ],
  }))
}

export function applyAssistantDelta(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'message/assistant/delta' }>,
): WorkbenchState {
  return withRun(state, event.runId, (run) =>
    replaceEntry(
      run,
      (entry) => entry.kind === 'assistant' && entry.id === event.data.entryId,
      (entry) => (entry.kind === 'assistant' ? { ...entry, text: entry.text + event.data.text } : entry),
      () => ({
        kind: 'assistant',
        id: event.data.entryId,
        at: event.at,
        text: event.data.text,
        streaming: true,
      }),
    ),
  )
}

export function applyAssistantDone(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'message/assistant/done' }>,
): WorkbenchState {
  return withRun(state, event.runId, (run) =>
    replaceEntry(
      run,
      (entry) => entry.kind === 'assistant' && entry.id === event.data.entryId,
      (entry) =>
        entry.kind === 'assistant'
          ? { ...entry, text: event.data.text, reasoning: event.data.reasoning, streaming: false }
          : entry,
      () => ({
        kind: 'assistant',
        id: event.data.entryId,
        at: event.at,
        text: event.data.text,
        reasoning: event.data.reasoning,
        streaming: false,
      }),
    ),
  )
}

export function applyToolStarted(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'tool/started' }>,
): WorkbenchState {
  return withRun(state, event.runId, (run) =>
    replaceEntry(
      run,
      (entry) => entry.kind === 'tool' && entry.callId === event.data.callId,
      (entry) => (entry.kind === 'tool' ? { ...entry, name: event.data.name, args: event.data.args } : entry),
      () => ({
        kind: 'tool',
        id: event.data.callId,
        callId: event.data.callId,
        at: event.at,
        name: event.data.name,
        args: event.data.args,
      }),
    ),
  )
}

export function applyToolFinished(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'tool/finished' }>,
): WorkbenchState {
  return withRun(state, event.runId, (run) =>
    replaceEntry(
      run,
      (entry) => entry.kind === 'tool' && entry.callId === event.data.callId,
      (entry) =>
        entry.kind === 'tool'
          ? {
              ...entry,
              ok: event.data.ok,
              summary: event.data.summary,
              content: event.data.content,
              durationMs: event.data.durationMs,
            }
          : entry,
      () => ({
        kind: 'tool',
        id: event.data.callId,
        callId: event.data.callId,
        at: event.at,
        name: event.data.name,
        args: '',
        ok: event.data.ok,
        summary: event.data.summary,
        content: event.data.content,
        durationMs: event.data.durationMs,
      }),
    ),
  )
}

export function applyApprovalResolved(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'approval/resolved' }>,
): WorkbenchState {
  return withRun(state, event.runId, (run) => ({
    ...run,
    approval: undefined,
    timeline: [
      ...run.timeline,
      {
        kind: 'approval',
        id: `approval-${event.data.requestId}`,
        at: event.at,
        requestId: event.data.requestId,
        name: event.data.name,
        decision: event.data.decision,
      },
    ],
  }))
}

export function applyUndoFinished(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'undo/finished' }>,
): WorkbenchState {
  return withRun(state, event.runId, (run) => ({
    ...run,
    timeline: [
      ...run.timeline,
      {
        kind: 'undo',
        id: `undo-${run.id}-${event.seq}`,
        at: event.at,
        steps: event.data.steps,
        ok: event.data.ok,
        failures: event.data.failures,
      },
    ],
    checkpoints: {
      ...run.checkpoints,
      currentTurn: Math.max(0, run.checkpoints.currentTurn - event.data.appliedSteps),
    },
  }))
}

export function applyRedoFinished(
  state: WorkbenchState,
  event: Extract<BridgeEvent, { type: 'redo/finished' }>,
): WorkbenchState {
  return withRun(state, event.runId, (run) => ({
    ...run,
    timeline: [
      ...run.timeline,
      {
        kind: 'redo',
        id: `redo-${run.id}-${event.seq}`,
        at: event.at,
        steps: event.data.steps,
        ok: event.data.ok,
        code: event.data.code,
      },
    ],
    checkpoints: {
      ...run.checkpoints,
      currentTurn: event.data.ok
        ? run.checkpoints.currentTurn + event.data.appliedSteps
        : run.checkpoints.currentTurn,
    },
  }))
}
