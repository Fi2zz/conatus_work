import { join } from 'node:path'

import { parseJson, readJson } from './json-io.mjs'

export function parseMoveText(text) {
  const match = /已移动：(.+?)\s*→\s*(.+?)（[^）]*?sha256=([0-9a-f]{64})/.exec(String(text))
  if (!match) return null
  return { from: match[1].trim(), to: match[2].trim(), sha256: match[3] }
}

function toChangeFile(operation) {
  return {
    from: operation.from,
    to: operation.to,
    sha256: operation.sha256 ?? '',
    ...(operation.reason ? { reason: operation.reason } : {}),
  }
}

function validOperation(operation) {
  return (
    typeof operation?.from === 'string' &&
    operation.from.length > 0 &&
    typeof operation?.to === 'string' &&
    operation.to.length > 0
  )
}

function fromRecorded(recorded) {
  if (!recorded || !Array.isArray(recorded.operations)) return null
  return {
    summary: {
      added: recorded.summary?.added ?? 0,
      modified: recorded.summary?.modified ?? 0,
      moved: recorded.summary?.moved ?? recorded.operations.length,
      deleted: recorded.summary?.deleted ?? 0,
      ...(recorded.summary?.quarantined ? { quarantined: recorded.summary.quarantined } : {}),
    },
    files: recorded.operations.map(toChangeFile),
  }
}

function fromMoveResults(rawEvents) {
  const derived = []
  for (const event of rawEvents) {
    if (event.type !== 'tool/result' || event.data?.name !== 'move' || event.data?.isError) continue
    const parsed = parseJson(event.data?.content) ?? parseMoveText(event.data?.content)
    if (!parsed) continue
    if (Array.isArray(parsed.operations)) derived.push(...parsed.operations)
    else if (parsed.from && parsed.to) derived.push(parsed)
  }

  const valid = derived.filter(validOperation)
  if (valid.length === 0) return null
  return {
    summary: { added: 0, modified: 0, moved: valid.length, deleted: 0 },
    files: valid.map(toChangeFile),
  }
}

export function buildChanges(workspaceRoot, rawEvents) {
  const recorded = readJson(join(workspaceRoot ?? '', 'out', 'changes.json'))
  return fromRecorded(recorded) ?? fromMoveResults(rawEvents)
}
