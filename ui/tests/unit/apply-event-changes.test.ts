import { applyEvent } from '@/state/apply-event'
import { initialWorkbenchState } from '@/state/workbench-state'

import { runA, snapshotEvent } from '../helpers/events'

function base() {
  return applyEvent(initialWorkbenchState, snapshotEvent([runA], 'run-a'))
}

const artifact = (path: string, bytes = 10) => ({
  path,
  bytes,
  sha256: 'abc',
  check: { exists: true, nonEmpty: true, passed: true },
})

it('adds an artifact once even if added twice', () => {
  const first = applyEvent(base(), { seq: 1, at: 10, type: 'artifact/added', runId: 'run-a', data: artifact('out/a.md') })
  const second = applyEvent(first, {
    seq: 2,
    at: 20,
    type: 'artifact/updated',
    runId: 'run-a',
    data: artifact('out/a.md', 99),
  })
  expect(second.runs['run-a'].artifacts).toHaveLength(1)
  expect(second.runs['run-a'].artifacts[0].bytes).toBe(99)
})

it('replaces the change set', () => {
  const next = applyEvent(base(), {
    seq: 1,
    at: 10,
    type: 'changes/updated',
    runId: 'run-a',
    data: { summary: { added: 0, modified: 0, moved: 11, deleted: 0 }, files: [] },
  })
  expect(next.runs['run-a'].changes?.summary.moved).toBe(11)
})

it('appends a checkpoint turn and updates currentTurn', () => {
  const next = applyEvent(base(), {
    seq: 1,
    at: 10,
    type: 'checkpoint/recorded',
    runId: 'run-a',
    data: { turn: 1, startTurn: 0, at: '2026-11-03T10:01:00+08:00', eventCount: 12 },
  })
  expect(next.runs['run-a'].checkpoints.currentTurn).toBe(1)
  expect(next.runs['run-a'].checkpoints.turns.map((turn) => turn.turn)).toEqual([1])
})

it('records a gap when turn jumps', () => {
  const first = applyEvent(base(), {
    seq: 1,
    at: 10,
    type: 'checkpoint/recorded',
    runId: 'run-a',
    data: { turn: 1, startTurn: 0, at: '2026-11-03T10:01:00+08:00', eventCount: 12 },
  })
  const next = applyEvent(first, {
    seq: 2,
    at: 20,
    type: 'checkpoint/recorded',
    runId: 'run-a',
    data: { turn: 3, startTurn: 0, at: '2026-11-03T10:03:00+08:00', eventCount: 20 },
  })
  expect(next.runs['run-a'].checkpoints.gaps).toEqual([2])
  expect(next.runs['run-a'].checkpoints.currentTurn).toBe(3)
})

it('undo/finished appends an auditable entry with failures', () => {
  const next = applyEvent(base(), {
    seq: 1,
    at: 10,
    type: 'undo/finished',
    runId: 'run-a',
    data: {
      ok: false,
      appliedSteps: 1,
      steps: 2,
      failures: [
        { path: 'a.docx', error: '权限不足' },
        { path: 'b.csv', error: '文件被占用' },
      ],
    },
  })
  const entry = next.runs['run-a'].timeline.at(-1)
  expect(entry).toMatchObject({ kind: 'undo', ok: false, steps: 2 })
  expect(entry && entry.kind === 'undo' ? entry.failures : []).toHaveLength(2)
})

it('failed undo still records appliedSteps', () => {
  const checkpointed = applyEvent(base(), {
    seq: 1,
    at: 5,
    type: 'checkpoint/recorded',
    runId: 'run-a',
    data: { turn: 2, startTurn: 0, at: '2026-11-03T10:02:00+08:00', eventCount: 8 },
  })
  const next = applyEvent(checkpointed, {
    seq: 2,
    at: 10,
    type: 'undo/finished',
    runId: 'run-a',
    data: { ok: false, appliedSteps: 1, steps: 2, failures: [] },
  })
  expect(next.runs['run-a'].checkpoints.currentTurn).toBe(1)
})
