import { useState } from 'react'
import type { JSX } from 'react'

import { getTransport } from '@/bridge/transport-store'
import type { RedoResult, UndoResult } from '@/bridge/types'
import { undoScope } from '@/state/selectors'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench } from '@/state/workbench-store'
import { cn } from '@/lib/utils'
import { DiffView } from './DiffView'
import { UndoDialog } from './UndoDialog'

export function ChangePanel(): JSX.Element {
  const run = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId] : undefined))
  const dialogOpen = useUiStore((state) => state.undoDialog)
  const setDialogOpen = useUiStore((state) => state.setUndoDialog)
  const [undoResult, setUndoResult] = useState<UndoResult | null>(null)
  const [redoResult, setRedoResult] = useState<RedoResult | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  if (!run) return <p className="p-3 text-[12px] text-ink-muted">未选择任务。</p>

  if (!run.changes) {
    return (
      <p data-testid="changes-empty" className="p-3 text-[12px] text-ink-muted">
        该运行未记录变更。
      </p>
    )
  }

  const scope = undoScope(run)
  const files = run.changes.files
  const activeFile = files.find((file) => file.to === selected) ?? files[0]

  async function confirmUndo(): Promise<void> {
    if (!scope.usable) return
    const result = await getTransport().undo(run!.id, scope.steps)
    if (!result.ok) return
    setUndoResult(result.value)
    if (result.value.ok) setDialogOpen(false)
  }

  async function requestRedo(): Promise<void> {
    const result = await getTransport().redo(run!.id, 1)
    if (result.ok) setRedoResult(result.value)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div data-testid="change-summary" className="flex items-center justify-between border-b border-line px-3 py-1.5 text-[11.5px]">
        <span>
          移动 {run.changes.summary.moved} · 新增 {run.changes.summary.added} · 修改{' '}
          {run.changes.summary.modified} · 删除 {run.changes.summary.deleted}
        </span>
        <span className="text-ink-muted">
          {scope.usable ? `可撤销至轮次 ${scope.targetTurn}` : scope.reason}
        </span>
      </div>

      <ul className="max-h-40 overflow-auto border-b border-line">
        {files.map((file) => (
          <li key={file.to}>
            <button
              type="button"
              onClick={() => setSelected(file.to)}
              className={cn(
                'w-full px-3 py-1 text-left font-mono text-[11px] hover:bg-panel-muted',
                activeFile?.to === file.to && 'bg-panel-muted',
              )}
            >
              <span className="block truncate">{file.to}</span>
              <span className="block truncate text-ink-muted">← {file.from}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {activeFile ? <DiffView from={activeFile.from} to={activeFile.to} /> : null}
      </div>

      {redoResult && !redoResult.ok ? (
        <p data-testid="undo-pruned" className="border-t border-line bg-warning/10 px-3 py-1 text-[11px] text-warning">
          {redoResult.code === 'PRUNED'
            ? '无法重做：目标轮次已不在保留范围。'
            : `无法重做：${redoResult.code ?? '未知原因'}`}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
        <button
          type="button"
          data-testid="redo-button"
          onClick={() => void requestRedo()}
          className="rounded border border-line px-2 py-1 text-[11.5px]"
        >
          重做
        </button>
        <button
          type="button"
          data-testid="undo-button"
          disabled={!scope.usable}
          onClick={() => {
            setUndoResult(null)
            setDialogOpen(true)
          }}
          className={cn(
            'rounded px-2 py-1 text-[11.5px] text-white',
            scope.usable ? 'bg-accent' : 'bg-ink-muted/40',
          )}
        >
          撤销这批变更
        </button>
      </div>

      {dialogOpen && scope.usable ? (
        <UndoDialog
          run={run}
          scope={scope}
          result={undoResult}
          onConfirm={() => void confirmUndo()}
          onClose={() => setDialogOpen(false)}
        />
      ) : null}
    </div>
  )
}
