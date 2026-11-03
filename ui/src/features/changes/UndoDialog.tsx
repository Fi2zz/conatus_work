import type { JSX } from 'react'

import type { RunView, UndoResult } from '@/bridge/types'
import type { UndoScope } from '@/state/selectors'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

interface UndoDialogProps {
  run: RunView
  scope: UndoScope
  result: UndoResult | null
  onConfirm: () => void
  onClose: () => void
}

export function UndoDialog({ run, scope, result, onConfirm, onClose }: UndoDialogProps): JSX.Element {
  const failed = result !== null && !result.ok
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent labelledBy="undo-dialog-title">
        <div data-testid="undo-dialog">
          <DialogTitle id="undo-dialog-title">
            {result?.ok ? '已撤销' : `撤销 ${scope.steps} 轮？`}
          </DialogTitle>
          <DialogDescription>
            撤销 {scope.steps} 轮，回退到轮次 {scope.targetTurn}，涉及 {run.changes?.files.length ?? 0} 个文件；
            检查点只保留最近 {run.checkpoints.keep} 轮。
          </DialogDescription>

          {result?.ok ? (
            <p className="mt-3 text-[12px] text-success">已回退 {result.appliedSteps} 轮，可以重做。</p>
          ) : null}

          {failed ? (
            <div className="mt-3">
              <p className="text-[12px] text-danger">回滚失败（已回退 {result.appliedSteps} 轮），逐文件结果：</p>
              <ul data-testid="undo-failure-list" className="mt-1 max-h-40 overflow-auto font-mono text-[11px]">
                {result.failures.map((failure) => (
                  <li key={failure.path} className="border-l-2 border-danger pl-2">
                    <span className="block truncate">{failure.path}</span>
                    <span className="text-ink-muted">{failure.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded border border-line px-2 py-1 text-[12px]">
              保留现状
            </button>
            {failed ? (
              <button
                type="button"
                onClick={onConfirm}
                className="rounded bg-accent px-2 py-1 text-[12px] text-white"
              >
                重试
              </button>
            ) : (
              <button
                type="button"
                onClick={onConfirm}
                className="rounded bg-accent px-2 py-1 text-[12px] text-white"
              >
                确认撤销
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
