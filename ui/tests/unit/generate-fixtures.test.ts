import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildFixture, stableStringify, writeFixtureFile } from '../../tools/lib/fixture-build.mjs'

interface RunDirOptions {
  card?: Record<string, unknown> | null
  events?: Array<Record<string, any>>
  files?: Record<string, string>
  changedFiles?: Array<Record<string, string>> | null
  turns?: { start: number; end: number | null }
  artifacts?: Array<{ path: string; bytes: number; sha256: string }>
}

const STARTED_AT = '2026-11-03T10:00:00.000+08:00'

function makeRunDir(options: RunDirOptions = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'work-fixture-'))
  const workspace = join(root, 'workspace')
  mkdirSync(join(workspace, 'out'), { recursive: true })

  for (const [path, content] of Object.entries(options.files ?? {})) {
    mkdirSync(join(workspace, path, '..'), { recursive: true })
    writeFileSync(join(workspace, path), content)
  }

  if (options.changedFiles) {
    writeFileSync(
      join(workspace, 'out', 'changes.json'),
      JSON.stringify({
        operations: options.changedFiles,
        summary: { moved: options.changedFiles.length, quarantined: 0, deleted: 0 },
      }),
    )
  }

  const run = {
    runId: 'run_test-1',
    taskId: 'folder-organize-v01',
    chain: 'organize',
    taskPath: join(root, 'task.json'),
    workspaceRoot: workspace,
    sessionId: 'events',
    startedAt: STARTED_AT,
    endedAt: '2026-11-03T10:01:00.000+08:00',
    status: 'succeeded',
    model: 'test/model',
    turns: options.turns ?? { start: 0, end: 1 },
    usage: { inputTokens: 10, outputTokens: 5, costUsd: 0.001 },
    artifacts: (options.artifacts ?? []).map((artifact) => ({
      ...artifact,
      check: { exists: true, nonEmpty: true, passed: true, reason: null },
    })),
  }
  writeFileSync(join(root, 'run.json'), JSON.stringify(run))

  if (options.card !== null) {
    writeFileSync(
      join(root, 'task.json'),
      JSON.stringify({ id: 'folder-organize-v01', title: '整理收件箱', checkpoint: { keep: 7 }, ...options.card }),
    )
  }

  const events = options.events ?? [
    { seq: 0, type: 'user/message', time: STARTED_AT, data: { text: '整理收件箱' } },
    { seq: 1, type: 'tool/result', time: STARTED_AT, data: { callId: 'c1', name: 'list', content: 'a', isError: false } },
  ]
  writeFileSync(join(root, 'events.jsonl'), events.map((event) => JSON.stringify(event)).join('\n'))

  return root
}

it('serialises keys in a stable order', () => {
  expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }))
})

it('writes byte-identical fixtures for the same run dir', () => {
  const dir = makeRunDir()
  const first = join(dir, 'a.json')
  const second = join(dir, 'b.json')
  writeFixtureFile(buildFixture(dir), first)
  writeFixtureFile(buildFixture(dir), second)
  expect(stableStringify(buildFixture(dir))).toBe(stableStringify(buildFixture(dir)))
  expect(first.length).toBeGreaterThan(0)
  expect(second.length).toBe(first.length)
})

it('keeps events ordered by at then original seq', () => {
  const sameMoment = '2026-11-03T10:00:02.000+08:00'
  const dir = makeRunDir({
    events: [
      { seq: 0, type: 'user/message', time: STARTED_AT, data: { text: '开始' } },
      { seq: 1, type: 'assistant/message', time: sameMoment, data: { text: '先看目录', toolCalls: [] } },
      { seq: 2, type: 'tool/result', time: sameMoment, data: { callId: 'c1', name: 'list', content: 'a', isError: false } },
    ],
  })
  const fixture = buildFixture(dir) as { events: Array<{ seq: number; at: number; type: string }> }
  const ats = fixture.events.map((event) => event.at)
  expect(ats).toEqual([...ats].sort((left, right) => left - right))
  expect(fixture.events.map((event) => event.seq)).toEqual(fixture.events.map((_, index) => index))
})

it('prefers out/changes.json for the change set', () => {
  const dir = makeRunDir({
    changedFiles: [{ from: 'inbox/a.docx', to: 'inbox/docx/a.docx', sha256: 'aaa', reason: '按类型' }],
  })
  const fixture = buildFixture(dir) as { changes: { summary: { moved: number }; files: unknown[] } | null }
  expect(fixture.changes?.summary.moved).toBe(1)
  expect(fixture.changes?.files).toHaveLength(1)
})

it('derives changes from move results when changes.json is absent', () => {
  const dir = makeRunDir({
    events: [
      { seq: 0, type: 'user/message', time: STARTED_AT, data: { text: '整理' } },
      {
        seq: 1,
        type: 'tool/result',
        time: STARTED_AT,
        data: {
          callId: 'c1',
          name: 'move',
          isError: false,
          content: JSON.stringify({ from: 'inbox/a.docx', to: 'inbox/docx/a.docx', sha256: 'bbb' }),
        },
      },
    ],
  })
  const fixture = buildFixture(dir) as { changes: { summary: { moved: number }; files: Array<{ sha256: string }> } | null }
  expect(fixture.changes?.summary.moved).toBe(1)
  expect(fixture.changes?.files[0].sha256).toBe('bbb')
})

it('sets changes to null when neither source exists', () => {
  const dir = makeRunDir()
  const fixture = buildFixture(dir) as { changes: unknown }
  expect(fixture.changes).toBeNull()
})

it('marks artifacts truncated above 64 KB', () => {
  const big = 'x'.repeat(70 * 1024)
  const dir = makeRunDir({
    files: { 'out/big.md': big },
    artifacts: [{ path: 'out/big.md', bytes: big.length, sha256: 'ccc' }],
  })
  const fixture = buildFixture(dir) as { artifacts: Array<{ path: string; truncated?: boolean }>; files: Record<string, string> }
  expect(fixture.artifacts[0].truncated).toBe(true)
  expect(fixture.files['out/big.md'].length).toBeLessThan(big.length)
})
