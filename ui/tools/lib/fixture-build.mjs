import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const MAX_INLINE_BYTES = 64 * 1024

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const sorted = {}
    for (const key of Object.keys(value).sort()) sorted[key] = sortKeys(value[key])
    return sorted
  }
  return value
}

export function stableStringify(value) {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`
}

export function writeFixtureFile(fixture, targetPath) {
  mkdirSync(dirname(targetPath), { recursive: true })
  writeFileSync(targetPath, stableStringify(fixture))
}

function readJson(path) {
  if (!path || !existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function readEvents(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function readWorkspaceFile(root, relativePath) {
  if (!root || !relativePath) return null
  const path = join(root, relativePath)
  if (!existsSync(path)) return null
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function toTimestamp(time) {
  const parsed = Date.parse(time)
  return Number.isNaN(parsed) ? null : parsed
}

function buildEventStream(rawEvents, startedAt) {
  const base = toTimestamp(startedAt) ?? 0
  const out = []
  const startedCallAt = new Map()
  let seq = 0

  for (const event of rawEvents) {
    const at = Math.max(0, (toTimestamp(event.time) ?? base) - base)

    if (event.type === 'user/message') {
      out.push({ seq: seq++, at, type: 'message/user', data: { text: event.data?.text ?? '' } })
      continue
    }

    if (event.type === 'assistant/message') {
      out.push({
        seq: seq++,
        at,
        type: 'message/assistant/done',
        data: {
          entryId: event.id ?? `assistant-${seq}`,
          text: event.data?.text ?? '',
          ...(event.data?.reasoning ? { reasoning: event.data.reasoning } : {}),
        },
      })
      for (const call of event.data?.toolCalls ?? []) {
        startedCallAt.set(call.id, at)
        out.push({
          seq: seq++,
          at,
          type: 'tool/started',
          data: { callId: call.id, name: call.name, args: call.arguments ?? '{}' },
        })
      }
      continue
    }

    if (event.type === 'tool/result') {
      const startedAtMs = startedCallAt.get(event.data?.callId) ?? at
      out.push({
        seq: seq++,
        at,
        type: 'tool/finished',
        data: {
          callId: event.data?.callId ?? `call-${seq}`,
          name: event.data?.name ?? 'unknown',
          ok: event.data?.isError !== true,
          summary: firstLine(event.data?.content ?? ''),
          content: clipContent(event.data?.content ?? ''),
          durationMs: Math.max(0, at - startedAtMs),
        },
      })
    }
  }

  return out
    .map((event, index) => ({ event, index }))
    .sort((left, right) => left.event.at - right.event.at || left.index - right.index)
    .map(({ event }, index) => ({ ...event, seq: index }))
}

function firstLine(text) {
  const line = String(text).split('\n').find((candidate) => candidate.trim().length > 0) ?? ''
  return line.length > 120 ? `${line.slice(0, 117)}…` : line
}

function clipContent(text) {
  const value = String(text ?? '')
  return value.length > 2000 ? `${value.slice(0, 2000)}…` : value
}

function parseMoveText(text) {
  const match = /已移动：(.+?)\s*→\s*(.+?)（[^）]*?sha256=([0-9a-f]{64})/.exec(String(text))
  if (!match) return null
  return { from: match[1].trim(), to: match[2].trim(), sha256: match[3] }
}

function buildChanges(workspaceRoot, rawEvents) {
  const recorded = readJson(join(workspaceRoot ?? '', 'out', 'changes.json'))
  if (recorded && Array.isArray(recorded.operations)) {
    return {
      summary: {
        added: 0,
        modified: 0,
        moved: recorded.summary?.moved ?? recorded.operations.length,
        deleted: recorded.summary?.deleted ?? 0,
        ...(recorded.summary?.quarantined ? { quarantined: recorded.summary.quarantined } : {}),
      },
      files: recorded.operations.map((operation) => ({
        from: operation.from,
        to: operation.to,
        sha256: operation.sha256 ?? '',
        ...(operation.reason ? { reason: operation.reason } : {}),
      })),
    }
  }

  const derived = []
  for (const event of rawEvents) {
    if (event.type !== 'tool/result' || event.data?.name !== 'move' || event.data?.isError) continue
    const parsed = parseJson(event.data?.content) ?? parseMoveText(event.data?.content)
    if (!parsed) continue
    if (Array.isArray(parsed.operations)) derived.push(...parsed.operations)
    else if (parsed.from && parsed.to) derived.push(parsed)
  }
  if (derived.length === 0) return null

  return {
    summary: { added: 0, modified: 0, moved: derived.length, deleted: 0 },
    files: derived.map((operation) => ({
      from: operation.from,
      to: operation.to,
      sha256: operation.sha256 ?? '',
      ...(operation.reason ? { reason: operation.reason } : {}),
    })),
  }
}

function parseJson(text) {
  if (typeof text !== 'string') return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function buildArtifacts(workspaceRoot, artifacts) {
  const files = {}
  const views = []
  for (const artifact of artifacts ?? []) {
    const view = {
      path: artifact.path,
      bytes: artifact.bytes ?? 0,
      sha256: artifact.sha256 ?? '',
      check: artifact.check ?? { exists: true, nonEmpty: true, passed: true, reason: null },
    }
    const content = readWorkspaceFile(workspaceRoot, artifact.path)
    if (content !== null) {
      const truncated = Buffer.byteLength(content, 'utf8') > MAX_INLINE_BYTES
      files[artifact.path] = truncated ? content.slice(0, MAX_INLINE_BYTES) : content
      if (truncated) view.truncated = true
    }
    views.push(view)
  }
  return { files, views }
}

export function buildFixture(runDir) {
  const run = readJson(join(runDir, 'run.json'))
  if (!run) throw new Error(`缺少 run.json: ${runDir}`)
  const card = readJson(run.taskPath)
  const rawEvents = readEvents(join(runDir, 'events.jsonl'))
  const base = toTimestamp(run.startedAt) ?? 0
  const endAt = Math.max(0, (toTimestamp(run.endedAt) ?? base) - base)
  const events = buildEventStream(rawEvents, run.startedAt)
  const { files, views } = buildArtifacts(run.workspaceRoot, run.artifacts)
  const changes = buildChanges(run.workspaceRoot, rawEvents)
  const keep = card?.checkpoint?.keep ?? 5
  const startTurn = run.turns?.start ?? 0
  const currentTurn = run.turns?.end ?? startTurn

  for (const artifact of views) {
    events.push({ seq: events.length, at: endAt, type: 'artifact/added', data: artifact })
  }
  if (changes) events.push({ seq: events.length, at: endAt, type: 'changes/updated', data: changes })
  if (currentTurn > startTurn) {
    events.push({
      seq: events.length,
      at: endAt,
      type: 'checkpoint/recorded',
      data: { turn: currentTurn, startTurn, at: run.endedAt ?? run.startedAt, eventCount: events.length },
    })
  }
  events.push({ seq: events.length, at: endAt, type: 'usage/updated', data: run.usage })
  events.push({
    seq: events.length,
    at: endAt,
    type: 'task/ended',
    data: {
      status: run.status,
      endedAt: run.endedAt ?? run.startedAt,
      failure: run.failure ?? { category: null, message: null },
    },
  })

  return {
    schemaVersion: 1,
    run: {
      id: run.runId,
      taskId: run.taskId,
      title: card?.title ?? run.taskId,
      chain: run.chain,
      status: run.status,
      model: run.model,
      startedAt: run.startedAt,
      ...(run.endedAt ? { endedAt: run.endedAt } : {}),
      usage: run.usage,
      workspaceRoot: run.workspaceRoot,
      synthetic: false,
    },
    events,
    artifacts: views,
    files,
    changes,
    checkpoints: { startTurn, currentTurn, keep, turns: [], gaps: [] },
  }
}

export function scanRunDirs(runsRoot) {
  if (!existsSync(runsRoot)) return []
  return readdirSync(runsRoot)
    .map((name) => join(runsRoot, name))
    .filter((dir) => existsSync(join(dir, 'run.json')))
}
