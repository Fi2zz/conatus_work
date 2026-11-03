import type { RunSummary, RunView, TimelineEntry } from '@/bridge/types'
import { applyEvent } from '@/state/apply-event'
import { diffLines, filterTimeline, groupConsecutiveTools, runMetrics, undoScope } from '@/state/selectors'
import { initialWorkbenchState } from '@/state/workbench-state'

import { runA, runB, snapshotEvent, usage } from '../helpers/events'

const tool = (id: string, name: string, ok?: boolean): TimelineEntry => ({
  kind: 'tool',
  id,
  callId: id,
  at: Number(id.replace(/\D/g, '')) || 0,
  name,
  args: '{}',
  ok,
  summary: `${name} ok`,
})

const message: TimelineEntry = { kind: 'assistant', id: 'm1', at: 0, text: '继续' }

function runWith(timeline: TimelineEntry[], checkpoints?: Partial<RunView['checkpoints']>): RunView {
  const state = applyEvent(initialWorkbenchState, snapshotEvent([runA], 'run-a'))
  return { ...state.runs['run-a'], timeline, checkpoints: { ...state.runs['run-a'].checkpoints, ...checkpoints } }
}

it('merges consecutive same-name tools', () => {
  const merged = groupConsecutiveTools([tool('1', 'move', true), tool('2', 'move', true), tool('3', 'move', true)])
  expect(merged).toHaveLength(1)
  expect(merged[0]).toMatchObject({ kind: 'tool', name: 'move', count: 3 })
})

it('does not merge across a message', () => {
  const merged = groupConsecutiveTools([tool('1', 'move', true), message, tool('2', 'move', true)])
  expect(merged).toHaveLength(3)
})

it('does not merge failed tools', () => {
  const merged = groupConsecutiveTools([tool('1', 'move', false), tool('2', 'move', true)])
  expect(merged).toHaveLength(2)
})

it('key mode hides successful reads but keeps writes and failures', () => {
  const timeline = [tool('1', 'read', true), tool('2', 'write', true), tool('3', 'read', false)]
  const kept = filterTimeline(timeline, 'key')
  expect(kept.map((entry) => entry.kind === 'tool' && entry.name)).toEqual(['write', 'read'])
})

it('undoScope returns the last recorded turn as target', () => {
  const run = runWith([], {
    currentTurn: 2,
    keep: 5,
    turns: [
      { turn: 1, at: '2026-11-03T10:01:00+08:00', eventCount: 3 },
      { turn: 2, at: '2026-11-03T10:02:00+08:00', eventCount: 6 },
    ],
  })
  expect(undoScope(run)).toMatchObject({ steps: 1, targetTurn: 1, usable: true })
})

it('undoScope is unusable when there is nothing to undo', () => {
  const scope = undoScope(runWith([], { currentTurn: 0, turns: [] }))
  expect(scope.usable).toBe(false)
  expect(scope.reason).toBe('没有可撤销的轮次')
})

it('undoScope is unusable and explains pruning', () => {
  const run = runWith([], {
    currentTurn: 5,
    keep: 2,
    turns: [
      { turn: 1, at: '2026-11-03T10:01:00+08:00', eventCount: 3 },
      { turn: 2, at: '2026-11-03T10:02:00+08:00', eventCount: 6 },
      { turn: 5, at: '2026-11-03T10:05:00+08:00', eventCount: 9 },
    ],
  })
  const scope = undoScope(run)
  expect(scope.usable).toBe(false)
  expect(scope.reason).toContain('已不在保留范围')
})

it('diffLines numbers additions and deletions', () => {
  expect(diffLines('- a\n+ b\n c')).toEqual([
    { n: 1, kind: 'del', text: 'a' },
    { n: 2, kind: 'add', text: 'b' },
    { n: 3, kind: 'context', text: 'c' },
  ])
})

it('runMetrics sums usage', () => {
  const runs: RunSummary[] = [runA, runB]
  expect(runMetrics(runs)).toEqual({ tasks: 2, inputTokens: 200, outputTokens: 100, costUsd: usage().costUsd * 2 })
})
