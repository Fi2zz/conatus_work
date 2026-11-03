import type { BridgeTransport } from '@/bridge/transport'
import { setTransport } from '@/bridge/transport-store'
import type { ChangeSet, CommandResult, RedoResult, UndoResult } from '@/bridge/types'
import { useUiStore } from '@/state/ui-state'
import { useWorkbenchStore } from '@/state/workbench-store'

import { seedRun } from './state'

interface SeedOptions {
  currentTurn?: number
  keep?: number
  turns?: number[]
  undo?: UndoResult
  redo?: RedoResult
}

export function changes(): ChangeSet {
  return {
    summary: { added: 0, modified: 0, moved: 11, deleted: 0 },
    files: [
      { from: 'inbox/a.docx', to: 'inbox/organized/docx/2026-01/a.docx', sha256: 'a'.repeat(64), reason: '按类型' },
      { from: 'inbox/b.csv', to: 'inbox/organized/csv/2026-02/b.csv', sha256: 'b'.repeat(64), reason: '按月份' },
    ],
  }
}

export function seedChanges(changeSet: ChangeSet | null, options: SeedOptions = {}): void {
  const currentTurn = options.currentTurn ?? 2
  const turns = (options.turns ?? [1]).map((turn) => ({
    turn,
    at: `2026-11-03T10:0${turn}:00+08:00`,
    eventCount: turn * 4,
  }))
  seedRun([], {
    changes: changeSet,
    checkpoints: { currentTurn, startTurn: 0, keep: options.keep ?? 5, turns, gaps: [] },
  })
  useUiStore.setState({ rightTab: 'changes', undoDialog: false, undoNotice: null })

  const transport = {
    async undo(_runId: string, steps: number): Promise<CommandResult<UndoResult>> {
      const value = options.undo ?? { ok: true, appliedSteps: steps, failures: [] }
      useWorkbenchStore.getState().apply({
        seq: 1000 + steps,
        at: 1000,
        type: 'undo/finished',
        runId: 'run-a',
        data: { ...value, steps },
      })
      return { ok: true, value }
    },
    async redo(_runId: string, steps: number): Promise<CommandResult<RedoResult>> {
      return { ok: true, value: options.redo ?? { ok: true, appliedSteps: steps } }
    },
  } as unknown as BridgeTransport
  setTransport(transport)
}
