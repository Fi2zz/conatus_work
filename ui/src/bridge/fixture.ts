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
