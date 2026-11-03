import { applyEvent } from '@/state/apply-event'
import { initialWorkbenchState } from '@/state/workbench-state'

import { runA, runB, snapshotEvent, userMessageEvent } from '../helpers/events'

it('builds run order from snapshot', () => {
  const state = applyEvent(initialWorkbenchState, snapshotEvent([runA, runB], 'run-b'))
  expect(state.order).toEqual(['run-b', 'run-a'])
  expect(state.activeRunId).toBe('run-b')
  expect(state.runs['run-a'].title).toBe('任务 A')
})

it('task/status only changes status', () => {
  const base = applyEvent(initialWorkbenchState, snapshotEvent([runA], 'run-a'))
  const next = applyEvent(base, {
    seq: 1,
    at: 10,
    type: 'task/status',
    runId: 'run-a',
    data: { status: 'running' },
  })
  expect(next.runs['run-a'].status).toBe('running')
  expect(next.runs['run-a'].timeline).toBe(base.runs['run-a'].timeline)
  expect(next.runs['run-a'].title).toBe('任务 A')
})

it('task/ended records failure category', () => {
  const base = applyEvent(initialWorkbenchState, snapshotEvent([runA], 'run-a'))
  const next = applyEvent(base, {
    seq: 1,
    at: 20,
    type: 'task/ended',
    runId: 'run-a',
    data: { status: 'failed', endedAt: '2026-11-03T10:02:00+08:00', failure: { category: 'llm', message: '超时' } },
  })
  expect(next.runs['run-a'].status).toBe('failed')
  expect(next.runs['run-a'].endedAt).toBe('2026-11-03T10:02:00+08:00')
})

it('usage/updated overwrites accumulated usage', () => {
  const base = applyEvent(initialWorkbenchState, snapshotEvent([runA], 'run-a'))
  const next = applyEvent(base, {
    seq: 1,
    at: 30,
    type: 'usage/updated',
    runId: 'run-a',
    data: { inputTokens: 999, outputTokens: 1, costUsd: 0.5 },
  })
  expect(next.runs['run-a'].usage).toEqual({ inputTokens: 999, outputTokens: 1, costUsd: 0.5 })
})

it('repeated seq is idempotent', () => {
  const once = applyEvent(initialWorkbenchState, userMessageEvent(7))
  const twice = applyEvent(once, userMessageEvent(7))
  expect(twice).toBe(once)
})

it('unknown event only bumps counter', () => {
  const event = { seq: 99, at: 0, type: 'future/thing', data: {} } as unknown as Parameters<typeof applyEvent>[1]
  const next = applyEvent(initialWorkbenchState, event)
  expect(next.unknownEvents).toBe(1)
  expect(next.order).toEqual([])
})
