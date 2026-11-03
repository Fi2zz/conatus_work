import { applyEvent } from '@/state/apply-event'
import { initialWorkbenchState } from '@/state/workbench-state'

import { runA, snapshotEvent } from '../helpers/events'

function base() {
  return applyEvent(initialWorkbenchState, snapshotEvent([runA], 'run-a'))
}

it('appends a user entry with its timestamp', () => {
  const next = applyEvent(base(), { seq: 1, at: 3000, type: 'message/user', runId: 'run-a', data: { text: '整理收件箱' } })
  const entry = next.runs['run-a'].timeline[0]
  expect(entry).toMatchObject({ kind: 'user', at: 3000, text: '整理收件箱' })
})

it('accumulates assistant deltas into one entry', () => {
  const first = applyEvent(base(), {
    seq: 1,
    at: 10,
    type: 'message/assistant/delta',
    runId: 'run-a',
    data: { entryId: 'e1', text: '我先' },
  })
  const second = applyEvent(first, {
    seq: 2,
    at: 20,
    type: 'message/assistant/delta',
    runId: 'run-a',
    data: { entryId: 'e1', text: '查看目录' },
  })
  const timeline = second.runs['run-a'].timeline
  expect(timeline).toHaveLength(1)
  expect(timeline[0]).toMatchObject({ kind: 'assistant', text: '我先查看目录', streaming: true })
})

it('done replaces streaming text with the final text', () => {
  const streaming = applyEvent(base(), {
    seq: 1,
    at: 10,
    type: 'message/assistant/delta',
    runId: 'run-a',
    data: { entryId: 'e1', text: '草稿' },
  })
  const done = applyEvent(streaming, {
    seq: 2,
    at: 20,
    type: 'message/assistant/done',
    runId: 'run-a',
    data: { entryId: 'e1', text: '最终', reasoning: '先列目录' },
  })
  expect(done.runs['run-a'].timeline[0]).toMatchObject({ text: '最终', reasoning: '先列目录', streaming: false })
})

it('tool/finished backfills ok and duration', () => {
  const started = applyEvent(base(), {
    seq: 1,
    at: 10,
    type: 'tool/started',
    runId: 'run-a',
    data: { callId: 'c1', name: 'list', args: '{"path":"inbox"}' },
  })
  const finished = applyEvent(started, {
    seq: 2,
    at: 40,
    type: 'tool/finished',
    runId: 'run-a',
    data: { callId: 'c1', name: 'list', ok: true, summary: '12 项', durationMs: 30 },
  })
  const timeline = finished.runs['run-a'].timeline
  expect(timeline).toHaveLength(1)
  expect(timeline[0]).toMatchObject({ kind: 'tool', ok: true, durationMs: 30, summary: '12 项' })
})

it('tool/finished without start still appends an entry', () => {
  const next = applyEvent(base(), {
    seq: 1,
    at: 10,
    type: 'tool/finished',
    runId: 'run-a',
    data: { callId: 'c9', name: 'move', ok: false, summary: '越界', durationMs: 5 },
  })
  expect(next.runs['run-a'].timeline[0]).toMatchObject({ kind: 'tool', callId: 'c9', ok: false })
})

it('plan/updated replaces the plan', () => {
  const next = applyEvent(base(), {
    seq: 1,
    at: 10,
    type: 'plan/updated',
    runId: 'run-a',
    data: { items: [{ id: 'p1', title: '读 inbox', status: 'done' }] },
  })
  expect(next.runs['run-a'].plan).toEqual([{ id: 'p1', title: '读 inbox', status: 'done' }])
})

it('approval/requested sets run.approval', () => {
  const next = applyEvent(base(), {
    seq: 1,
    at: 10,
    type: 'approval/requested',
    runId: 'run-a',
    data: { requestId: 'r1', callId: 'c1', name: 'write', args: '{}', riskLevel: 'high' },
  })
  expect(next.runs['run-a'].approval?.requestId).toBe('r1')
})

it('approval/resolved clears it and appends an audit entry', () => {
  const requested = applyEvent(base(), {
    seq: 1,
    at: 10,
    type: 'approval/requested',
    runId: 'run-a',
    data: { requestId: 'r1', callId: 'c1', name: 'write', args: '{}', riskLevel: 'high' },
  })
  const resolved = applyEvent(requested, {
    seq: 2,
    at: 20,
    type: 'approval/resolved',
    runId: 'run-a',
    data: { requestId: 'r1', name: 'write', decision: 'deny' },
  })
  const run = resolved.runs['run-a']
  expect(run.approval).toBeUndefined()
  expect(run.timeline.at(-1)).toMatchObject({ kind: 'approval', decision: 'deny' })
})
