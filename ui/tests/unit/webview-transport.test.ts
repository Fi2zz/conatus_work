import { createWindowChannel, createWebViewTransport, type HostChannel } from '@/bridge/webview-transport'

class FakeChannel implements HostChannel {
  sent: Array<Record<string, unknown>> = []
  private listeners = new Set<(frame: unknown) => void>()

  post(frame: unknown): void {
    this.sent.push(frame as Record<string, unknown>)
  }

  subscribe(listener: (frame: unknown) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  receive(frame: unknown): void {
    for (const listener of [...this.listeners]) listener(frame)
  }

  commands(): Array<Record<string, unknown>> {
    return this.sent.filter((frame) => frame.kind === 'command')
  }
}

const fixture = {
  schemaVersion: 1,
  run: {
    id: 'run-x',
    taskId: 'task-x',
    title: '合成任务',
    chain: 'organize',
    status: 'succeeded',
    model: 'test/model',
    startedAt: '2026-11-03T10:00:00+08:00',
    endedAt: '2026-11-03T10:01:00+08:00',
    usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
    workspaceRoot: 'workspace',
    synthetic: false,
  },
  events: [
    { seq: 0, at: 0, type: 'message/user', data: { text: '整理收件箱' } },
    {
      seq: 1,
      at: 10,
      type: 'checkpoint/recorded',
      data: { turn: 1, startTurn: 0, at: '2026-11-03T10:01:00+08:00', eventCount: 2 },
    },
    {
      seq: 2,
      at: 10,
      type: 'task/ended',
      data: { status: 'succeeded', endedAt: '2026-11-03T10:01:00+08:00', failure: { category: null, message: null } },
    },
  ],
  artifacts: [],
  files: {},
  changes: null,
  checkpoints: { startTurn: 0, currentTurn: 1, keep: 5, turns: [], gaps: [] },
}

async function connected(): Promise<{ channel: FakeChannel; transport: ReturnType<typeof createWebViewTransport> }> {
  const channel = new FakeChannel()
  const transport = createWebViewTransport({ channel, timeoutMs: 50 })
  const ready = transport.connect()
  channel.receive({ v: 1, kind: 'welcome' })
  await ready
  return { channel, transport }
}

it('performs the hello/welcome handshake', async () => {
  const channel = new FakeChannel()
  const transport = createWebViewTransport({ channel, timeoutMs: 50 })
  const ready = transport.connect()
  expect(channel.sent[0]).toMatchObject({ v: 1, kind: 'hello' })
  channel.receive({ v: 1, kind: 'welcome' })
  await ready
})

it('fails when the host never answers', async () => {
  const transport = createWebViewTransport({ channel: new FakeChannel(), timeoutMs: 5 })
  await expect(transport.connect()).rejects.toThrow(/hello/)
})

it('pairs concurrent responses by id', async () => {
  const { channel, transport } = await connected()
  const first = transport.listTasks()
  const second = transport.listTasks()
  const [a, b] = channel.commands()
  channel.receive({ v: 1, kind: 'result', id: b.id, ok: true, value: [{ id: 'run-b' }] })
  channel.receive({ v: 1, kind: 'result', id: a.id, ok: true, value: [{ id: 'run-a' }] })
  const [one, two] = await Promise.all([first, second])
  expect(one).toMatchObject({ ok: true, value: [{ id: 'run-a' }] })
  expect(two).toMatchObject({ ok: true, value: [{ id: 'run-b' }] })
})

it('ignores malformed frames', async () => {
  const { channel, transport } = await connected()
  channel.receive('nonsense')
  channel.receive({ hello: true })
  channel.receive({ v: 1, kind: 'result' })
  const pending = transport.listTasks()
  expect(channel.commands()).toHaveLength(1)
  channel.receive({ v: 1, kind: 'result', id: channel.commands()[0].id, ok: true, value: [] })
  expect(await pending).toEqual({ ok: true, value: [] })
})

it('folds the opened fixture into a run view', async () => {
  const { channel, transport } = await connected()
  const pending = transport.openTask('run-x')
  channel.receive({ v: 1, kind: 'result', id: channel.commands()[0].id, ok: true, value: fixture })
  const result = await pending
  if (!result.ok) throw new Error('expected ok')
  expect(result.value.timeline).toHaveLength(1)
  expect(result.value.checkpoints.currentTurn).toBe(1)
})

it('passes command errors through', async () => {
  const { channel, transport } = await connected()
  const pending = transport.openTask('nope')
  channel.receive({
    v: 1,
    kind: 'result',
    id: channel.commands()[0].id,
    ok: false,
    error: { code: 'NOT_FOUND', message: '没有这个运行' },
  })
  expect(await pending).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
})

it('sends message.send with the run id and text', async () => {
  const { channel, transport } = await connected()
  const pending = transport.sendMessage('run-x', '继续整理剩下的一半')
  const frame = channel.commands()[0]
  expect(frame.command).toBe('message.send')
  expect(frame.payload).toEqual({ runId: 'run-x', text: '继续整理剩下的一半' })
  channel.receive({ v: 1, kind: 'result', id: frame.id, ok: true })
  expect(await pending).toEqual({ ok: true, value: undefined })
})

it('sends approval.respond with the decision', async () => {
  const { channel, transport } = await connected()
  const pending = transport.respondApproval('req-1', 'deny')
  const frame = channel.commands()[0]
  expect(frame.command).toBe('approval.respond')
  expect(frame.payload).toEqual({ requestId: 'req-1', decision: 'deny' })
  channel.receive({
    v: 1,
    kind: 'result',
    id: frame.id,
    ok: false,
    error: { code: 'DENIED', message: '审批已过期' },
  })
  expect(await pending).toMatchObject({ ok: false, error: { code: 'DENIED' } })
})

it('drops messages that do not come from the parent window', () => {
  const channel = createWindowChannel(window)
  const seen: unknown[] = []
  channel.subscribe((frame) => seen.push(frame))
  window.dispatchEvent(new MessageEvent('message', { data: { v: 1, kind: 'welcome' }, source: null }))
  window.dispatchEvent(
    new MessageEvent('message', { data: { v: 1, kind: 'welcome' }, source: window.parent }),
  )
  expect(seen).toHaveLength(1)
})

it('uses the WKWebView javascript channel when present', () => {
  const sent: unknown[] = []
  ;(window as unknown as { conatus?: unknown }).conatus = {
    postMessage: (value: unknown) => sent.push(value),
  }
  const channel = createWindowChannel(window)
  const seen: unknown[] = []
  const off = channel.subscribe((frame) => seen.push(frame))

  channel.post({ v: 1, kind: 'hello' })
  expect(typeof sent[0]).toBe('string')
  expect(JSON.parse(sent[0] as string)).toMatchObject({ kind: 'hello' })

  ;(window as unknown as { __conatusReceive: (raw: string) => void }).__conatusReceive(
    '{"v":1,"kind":"welcome"}',
  )
  expect(seen).toEqual([{ v: 1, kind: 'welcome' }])

  off()
  delete (window as unknown as { conatus?: unknown }).conatus
})

it('asks the host to choose a workspace and passes it to task.start', async () => {
  const { channel, transport } = await connected()

  const picking = transport.chooseWorkspace()
  const pickFrame = channel.commands()[0]
  channel.receive({ v: 1, kind: 'result', id: pickFrame.id, ok: true, value: { path: '/tmp/ws' } })
  expect(await picking).toEqual({ ok: true, value: { path: '/tmp/ws' } })

  const starting = transport.startTask('move-v01', '/tmp/ws')
  const startFrame = channel.commands()[1]
  expect(startFrame.payload).toEqual({ cardId: 'move-v01', workspaceRoot: '/tmp/ws' })
  channel.receive({ v: 1, kind: 'result', id: startFrame.id, ok: true, value: { runId: 'run-1' } })
  expect(await starting).toEqual({ ok: true, value: { runId: 'run-1' } })
})

it('sends task.cancel and reports the abort status', async () => {
  const { channel, transport } = await connected()
  const pending = transport.cancelTask('run-x')
  const frame = channel.commands()[0]
  expect(frame.command).toBe('task.cancel')
  expect(frame.payload).toEqual({ runId: 'run-x' })
  channel.receive({ v: 1, kind: 'result', id: frame.id, ok: true, value: { status: 'aborted' } })
  expect(await pending).toEqual({ ok: true, value: { status: 'aborted' } })
})
