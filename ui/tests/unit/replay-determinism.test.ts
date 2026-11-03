import type { BridgeEvent } from '@/bridge/events'
import type { ReplayFixture } from '@/bridge/fixture'
import { parseFixture } from '@/bridge/fixture'
import { ManualScheduler } from '@/bridge/scheduler'
import { createReplayTransport } from '@/bridge/replay-transport'
import { applyEvent } from '@/state/apply-event'
import { initialWorkbenchState } from '@/state/workbench-state'

function fixtureWith(ats: number[]): ReplayFixture {
  return parseFixture({
    schemaVersion: 1,
    run: {
      id: 'run-x',
      taskId: 'task-x',
      title: '合成任务',
      chain: 'organize',
      status: 'succeeded',
      model: 'test/model',
      startedAt: '2026-11-03T10:00:00.000+08:00',
      endedAt: '2026-11-03T10:05:00.000+08:00',
      usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
      workspaceRoot: '(none)',
      synthetic: true,
    },
    events: ats.map((at, index) => ({
      seq: index,
      at,
      type: 'message/user',
      data: { text: `第 ${index} 条` },
    })),
    artifacts: [],
    files: {},
    changes: null,
    checkpoints: { startTurn: 0, currentTurn: 0, keep: 5, turns: [], gaps: [] },
  })
}

async function collect(fixture: ReplayFixture, scheduler: ManualScheduler, advanceMs = 10_000): Promise<BridgeEvent[]> {
  const transport = createReplayTransport(fixture, { scheduler })
  const events: BridgeEvent[] = []
  transport.subscribe((event) => events.push(event))
  await transport.connect()
  scheduler.advance(advanceMs)
  return events
}

it('emits a snapshot before any event', async () => {
  const scheduler = new ManualScheduler()
  const events = await collect(fixtureWith([100]), scheduler)
  expect(events[0].type).toBe('snapshot')
  expect(events[0].seq).toBeLessThan(events[1].seq)
})

it('fires events in order as time advances', async () => {
  const scheduler = new ManualScheduler()
  const transport = createReplayTransport(fixtureWith([100, 5000]), { scheduler })
  const types: string[] = []
  transport.subscribe((event) => types.push(event.type))
  await transport.connect()
  scheduler.advance(200)
  expect(types.filter((type) => type === 'message/user')).toHaveLength(1)
  scheduler.advance(6000)
  expect(types.filter((type) => type === 'message/user')).toHaveLength(2)
})

it('speed 0 emits everything synchronously', async () => {
  const transport = createReplayTransport(fixtureWith([10, 20, 30]), { speed: 0 })
  const events: BridgeEvent[] = []
  transport.subscribe((event) => events.push(event))
  await transport.connect()
  expect(events).toHaveLength(4)
})

it('handles non-monotonic at without dropping events', async () => {
  const scheduler = new ManualScheduler()
  const events = await collect(fixtureWith([0, 900, 400]), scheduler)
  const userEvents = events.filter((event) => event.type === 'message/user')
  expect(userEvents).toHaveLength(3)
  const ats = userEvents.map((event) => event.at)
  expect(ats).toEqual([...ats].sort((left, right) => left - right))
})

it('is deterministic across two replays', async () => {
  const fixture = fixtureWith([0, 300, 1200, 1300])
  const first = await collect(fixture, new ManualScheduler())
  const second = await collect(fixture, new ManualScheduler())
  expect(first.map((event) => event.seq)).toEqual(second.map((event) => event.seq))
  const fold = (events: BridgeEvent[]) => events.reduce((state, event) => applyEvent(state, event), initialWorkbenchState)
  expect(fold(first)).toEqual(fold(second))
})

it('returns NOT_FOUND for an unknown cardId', async () => {
  const transport = createReplayTransport(fixtureWith([]), { speed: 0 })
  await transport.connect()
  const result = await transport.startTask('nope')
  expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
})

it('serves artifact content from the fixture', async () => {
  const fixture = fixtureWith([])
  fixture.files['out/a.md'] = '# 标题'
  const transport = createReplayTransport(fixture, { speed: 0 })
  await transport.connect()
  expect(await transport.readArtifact('run-x', 'out/a.md')).toMatchObject({ ok: true, value: { content: '# 标题' } })
  expect(await transport.readArtifact('run-x', 'out/missing.md')).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
})

it('respondApproval emits an approval/resolved event', async () => {
  const fixture = parseFixture({
    ...(fixtureWith([]) as unknown as Record<string, unknown>),
    events: [
      {
        seq: 0,
        at: 0,
        type: 'approval/requested',
        data: { requestId: 'req-1', callId: 'c1', name: 'move', args: '{}', riskLevel: 'high' },
      },
    ],
  })
  const transport = createReplayTransport(fixture, { speed: 0 })
  const events: BridgeEvent[] = []
  transport.subscribe((event) => events.push(event))
  await transport.connect()
  await transport.respondApproval('req-1', 'deny')
  const resolved = events.find((event) => event.type === 'approval/resolved')
  expect(resolved).toMatchObject({ runId: 'run-x', data: { requestId: 'req-1', decision: 'deny' } })
})

it('openTask folds only up to now and leaves emission seqs untouched', async () => {
  const scheduler = new ManualScheduler()
  const transport = createReplayTransport(fixtureWith([100, 5000]), { scheduler })
  const seen: number[] = []
  transport.subscribe((event) => seen.push(event.seq))
  await transport.connect()

  const opened = await transport.openTask('run-x')
  if (!opened.ok) throw new Error('expected ok')
  expect(opened.value.timeline).toHaveLength(0)

  scheduler.advance(200)
  scheduler.advance(6000)
  expect(seen.filter((seq) => seq >= 0)).toEqual([0, 1])
})
