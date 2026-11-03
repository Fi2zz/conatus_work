import type { BridgeEvent } from '@/bridge/events'
import type { RunSummary, RunView, TimelineEntry, WorkbenchState } from '@/bridge/types'

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

function replaceEntry(
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

    case 'message/user':
      return withRun(marked, event.runId, (run) => ({
        ...run,
        timeline: [
          ...run.timeline,
          { kind: 'user', id: `${event.runId}-${event.seq}`, at: event.at, text: event.data.text },
        ],
      }))

    case 'message/assistant/delta':
      return withRun(marked, event.runId, (run) =>
        replaceEntry(
          run,
          (entry) => entry.kind === 'assistant' && entry.id === event.data.entryId,
          (entry) =>
            entry.kind === 'assistant' ? { ...entry, text: entry.text + event.data.text } : entry,
          () => ({
            kind: 'assistant',
            id: event.data.entryId,
            at: event.at,
            text: event.data.text,
            streaming: true,
          }),
        ),
      )

    case 'message/assistant/done':
      return withRun(marked, event.runId, (run) =>
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

    case 'tool/started':
      return withRun(marked, event.runId, (run) => ({
        ...run,
        timeline: [
          ...run.timeline,
          {
            kind: 'tool',
            id: event.data.callId,
            callId: event.data.callId,
            at: event.at,
            name: event.data.name,
            args: event.data.args,
          },
        ],
      }))

    case 'tool/finished':
      return withRun(marked, event.runId, (run) =>
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

    case 'plan/updated':
      return withRun(marked, event.runId, (run) => ({ ...run, plan: event.data.items }))

    case 'approval/requested':
      return withRun(marked, event.runId, (run) => ({ ...run, approval: event.data }))

    case 'approval/resolved':
      return withRun(marked, event.runId, (run) => ({
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

    case 'undo/started':
      return marked

    case 'artifact/added':
    case 'artifact/updated':
      return withRun(marked, event.runId, (run) => {
        const index = run.artifacts.findIndex((item) => item.path === event.data.path)
        if (index < 0) return { ...run, artifacts: [...run.artifacts, event.data] }
        const artifacts = [...run.artifacts]
        artifacts[index] = event.data
        return { ...run, artifacts }
      })

    case 'changes/updated':
      return withRun(marked, event.runId, (run) => ({ ...run, changes: event.data }))

    case 'checkpoint/recorded':
      return withRun(marked, event.runId, (run) => {
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
            currentTurn: Math.max(run.checkpoints.currentTurn, event.data.turn),
          },
        }
      })

    case 'undo/finished':
      return withRun(marked, event.runId, (run) => ({
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

    default:
      return { ...marked, unknownEvents: marked.unknownEvents + 1 }
  }
}
