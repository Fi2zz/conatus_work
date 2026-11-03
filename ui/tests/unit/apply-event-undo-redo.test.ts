import { applyEvent } from '@/state/apply-event'
import { initialWorkbenchState } from '@/state/workbench-state'

import { runA, snapshotEvent } from '../helpers/events'

function base() {
  return applyEvent(initialWorkbenchState, snapshotEvent([runA], 'run-a'))
}

function withTurn() {
  return applyEvent(base(), {
    seq: 1,
    at: 10,
    type: 'checkpoint/recorded',
    runId: 'run-a',
    data: { turn: 1, startTurn: 0, at: '2026-11-03T10:01:00+08:00', eventCount: 4 },
  })
}

it('redo/finished restores the current turn and appends an audit entry', () => {
  const undone = applyEvent(withTurn(), {
    seq: 2,
    at: 20,
    type: 'undo/finished',
    runId: 'run-a',
    data: { ok: true, appliedSteps: 1, steps: 1, failures: [] },
  })
  expect(undone.runs['run-a'].checkpoints.currentTurn).toBe(0)

  const redone = applyEvent(undone, {
    seq: 3,
    at: 30,
    type: 'redo/finished',
    runId: 'run-a',
    data: { ok: true, appliedSteps: 1, steps: 1 },
  })
  expect(redone.runs['run-a'].checkpoints.currentTurn).toBe(1)
  expect(redone.runs['run-a'].timeline.at(-1)).toMatchObject({ kind: 'redo', ok: true, steps: 1 })
  expect(redone.unknownEvents).toBe(0)
})

it('failed redo leaves the turn untouched but still records the attempt', () => {
  const redone = applyEvent(withTurn(), {
    seq: 2,
    at: 20,
    type: 'redo/finished',
    runId: 'run-a',
    data: { ok: false, appliedSteps: 0, steps: 1, code: 'PRUNED' },
  })
  expect(redone.runs['run-a'].checkpoints.currentTurn).toBe(1)
  expect(redone.runs['run-a'].timeline.at(-1)).toMatchObject({ kind: 'redo', ok: false })
})

it('tool/started with an existing callId updates instead of duplicating', () => {
  const first = applyEvent(base(), {
    seq: 1,
    at: 10,
    type: 'tool/started',
    runId: 'run-a',
    data: { callId: 'c1', name: 'list', args: '{"path":"inbox"}' },
  })
  const second = applyEvent(first, {
    seq: 2,
    at: 12,
    type: 'tool/started',
    runId: 'run-a',
    data: { callId: 'c1', name: 'list', args: '{"path":"inbox","depth":2}' },
  })
  const tools = second.runs['run-a'].timeline.filter((entry) => entry.kind === 'tool')
  expect(tools).toHaveLength(1)
  expect(tools[0]).toMatchObject({ args: '{"path":"inbox","depth":2}' })
})

it('snapshot seeds checkpoints from the host', () => {
  const state = applyEvent(initialWorkbenchState, {
    seq: -1,
    at: 0,
    type: 'snapshot',
    data: {
      runs: [runA],
      activeRunId: 'run-a',
      checkpoints: {
        'run-a': { currentTurn: 1, startTurn: 0, keep: 30, turns: [], gaps: [] },
      },
    },
  })
  expect(state.runs['run-a'].checkpoints.keep).toBe(30)
})

it('reconnect snapshot keeps live turns but refreshes keep', () => {
  const live = withTurn()
  const reconnected = applyEvent(live, {
    seq: -1,
    at: 0,
    type: 'snapshot',
    data: {
      runs: [runA],
      activeRunId: 'run-a',
      checkpoints: { 'run-a': { currentTurn: 9, startTurn: 0, keep: 7, turns: [], gaps: [] } },
    },
  })
  const checkpoints = reconnected.runs['run-a'].checkpoints
  expect(checkpoints.turns).toHaveLength(1)
  expect(checkpoints.currentTurn).toBe(1)
  expect(checkpoints.keep).toBe(7)
})

it('applies a repeated snapshot so a reconnect refreshes metadata', () => {
  const first = applyEvent(initialWorkbenchState, snapshotEvent([runA], 'run-a'))
  const second = applyEvent(
    first,
    snapshotEvent([{ ...runA, title: '改名后的任务' }], 'run-a'),
  )
  expect(second.runs['run-a'].title).toBe('改名后的任务')
  expect(second.runs['run-a'].timeline).toBe(first.runs['run-a'].timeline)
})
