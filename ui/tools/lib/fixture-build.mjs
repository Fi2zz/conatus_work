import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { buildArtifacts } from './artifacts.mjs'
import { buildChanges } from './changes.mjs'
import { buildEventStream } from './events.mjs'
import { readEvents, readJson, toTimestamp } from './json-io.mjs'

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

export function buildFixture(runDir) {
  const run = readJson(join(runDir, 'run.json'))
  if (!run) throw new Error(`缺少 run.json: ${runDir}`)
  // 投影输入自带 workspace/ 时以它为准：fixture 输入自包含，不依赖本机 var/。
  // 输出里记逻辑路径 `workspace`，避免把本机绝对路径写进产物。
  const bundled = existsSync(join(runDir, 'workspace'))
  const workspaceRoot = bundled ? join(runDir, 'workspace') : run.workspaceRoot
  const card = readJson(join(runDir, 'task.json')) ?? readJson(run.taskPath)
  const rawEvents = readEvents(join(runDir, 'events.jsonl'))
  const base = toTimestamp(run.startedAt) ?? 0
  const endAt = Math.max(0, (toTimestamp(run.endedAt) ?? base) - base)
  const events = buildEventStream(rawEvents, run.startedAt)
  const { files, views } = buildArtifacts(workspaceRoot, run.artifacts)
  const changes = buildChanges(workspaceRoot, rawEvents)
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
      workspaceRoot: bundled ? 'workspace' : run.workspaceRoot,
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
