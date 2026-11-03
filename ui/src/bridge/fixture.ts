import type { ArtifactView, ChangeSet, CheckpointView, RedoResult, RunSummary, UndoResult } from './types'

export interface ReplayFixture {
  schemaVersion: 1
  run: RunSummary & { workspaceRoot: string; synthetic: boolean }
  events: Array<{ seq: number; at: number; type: string; data: unknown }>
  artifacts: ArtifactView[]
  files: Record<string, string>
  changes: ChangeSet | null
  checkpoints: CheckpointView & { startTurn: number }
  scripts?: { undo?: UndoResult; redo?: RedoResult }
}

export class FixtureError extends Error {
  readonly field: string

  constructor(field: string, message?: string) {
    super(message ?? `fixture 缺少字段：${field}`)
    this.name = 'FixtureError'
    this.field = field
  }
}

function fail(field: string, message?: string): never {
  throw new FixtureError(field, message)
}

function objectAt(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(field)
  return value as Record<string, unknown>
}

function arrayAt(value: unknown, field: string): void {
  if (!Array.isArray(value)) fail(field)
}

function stringAt(value: unknown, field: string): void {
  if (typeof value !== 'string' || value.length === 0) fail(field)
}

function numberAt(value: unknown, field: string): void {
  if (typeof value !== 'number' || Number.isNaN(value)) fail(field)
}

export function parseFixture(input: unknown): ReplayFixture {
  const root = objectAt(input, 'root')
  if (root.schemaVersion !== 1) {
    fail('schemaVersion', `不支持的 schemaVersion：${String(root.schemaVersion)}`)
  }

  const run = objectAt(root.run, 'run')
  for (const field of ['id', 'taskId', 'status', 'model', 'startedAt']) stringAt(run[field], `run.${field}`)
  objectAt(run.usage, 'run.usage')

  arrayAt(root.events, 'events')
  arrayAt(root.artifacts, 'artifacts')
  objectAt(root.files, 'files')
  if (!('changes' in root)) fail('changes')

  const checkpoints = objectAt(root.checkpoints, 'checkpoints')
  numberAt(checkpoints.currentTurn, 'checkpoints.currentTurn')
  numberAt(checkpoints.keep, 'checkpoints.keep')
  numberAt(checkpoints.startTurn, 'checkpoints.startTurn')
  arrayAt(checkpoints.turns, 'checkpoints.turns')
  arrayAt(checkpoints.gaps, 'checkpoints.gaps')

  return root as unknown as ReplayFixture
}
