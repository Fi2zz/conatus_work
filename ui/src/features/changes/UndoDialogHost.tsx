import type { JSX } from 'react'

import { getTransport } from '@/bridge/transport-store'
import type { BridgeErrorCode, RunView, UndoResult } from '@/bridge/types'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { undoScope, type UndoScope } from '@/state/selectors'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench, useWorkbenchStore } from '@/state/workbench-store'
import { useEffect, useState } from 'react'

const ERROR_TEXT: Record<BridgeErrorCode, string> = {
  PRUNED: '目标轮次已不在保留范围，无法撤销或重做。',
  STALE_TURN: '任务状态已变化，请重新打开确认。',
  DENIED: '操作被拒绝。',
  NOT_FOUND: '找不到目标运行或轮次。',
  INTERNAL: '宿主内部错误。',
}

export function UndoDialogHost(): JSX.Element {
  const open = useUiStore((state) => state.undoDialog)
  const setOpen = useUiStore((state) => state.setUndoDialog)
  const setNotice = useUiStore((state) => state.setUndoNotice)
  const run = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId] : undefined))
  const [frozen, setFrozen] = useState<UndoScope | null>(null)
  const [result, setResult] = useState<UndoResult | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setFrozen(null)
      setResult(null)
      setFailure(null)
      return
    }
    setResult(null)
    setFailure(null)
    const current = activeRun()
    setFrozen(current ? undoScope(current) : null)
  }, [open])

  if (!open || !run) return <></>

  const live = undoScope(run)
  const scope = frozen ?? live
  const blocked = !scope.usable

  async function confirm(): Promise<void> {
    const fresh = activeRun()
    if (!fresh) return
    const current = undoScope(fresh)
    if (!current.usable || current.steps !== scope.steps) {
      setFailure(ERROR_TEXT.STALE_TURN)
      return
    }
    const response = await getTransport().undo(fresh.id, current.steps)
    if (!response.ok) {
      setFailure(ERROR_TEXT[response.error.code])
      return
    }
    setResult(response.value)
    if (response.value.ok) {
      setNotice({ runId: fresh.id, targetTurn: current.targetTurn ?? 0, steps: current.steps })
      setOpen(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : setOpen(false))}>
      <DialogContent labelledBy="undo-dialog-title">
        <div data-testid={blocked ? 'undo-blocked' : 'undo-dialog'}>
          <DialogTitle id="undo-dialog-title">{blocked ? '无法撤销' : `撤销 ${scope.steps} 轮？`}</DialogTitle>
          {blocked ? (
            <p className="text-[12px] text-ink-muted">{scope.reason}</p>
          ) : (
            <p className="text-[12px] text-ink-muted">
              撤销 {scope.steps} 轮，回退到轮次 {scope.targetTurn}，涉及 {run.changes?.files.length ?? 0} 个文件；
              检查点只保留最近 {run.checkpoints.keep} 轮。
            </p>
          )}

          {failure ? (
            <p data-testid="command-error" className="mt-2 text-[12px] text-danger">
              {failure}
            </p>
          ) : null}

          {result && !result.ok ? (
            <div className="mt-3">
              <p className="text-[12px] text-danger">回滚失败（已回退 {result.appliedSteps} 轮），逐文件结果：</p>
              <ul data-testid="undo-failure-list" className="mt-1 max-h-40 overflow-auto font-mono text-[11px]">
                {result.failures.map((item) => (
                  <li key={item.path} className="border-l-2 border-danger pl-2">
                    <span className="block truncate">{item.path}</span>
                    <span className="text-ink-muted">{item.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded border border-line px-2 py-1 text-[12px]">
              {blocked ? '关闭' : '保留现状'}
            </button>
            {!blocked ? (
              <button
                type="button"
                onClick={() => void confirm()}
                className="rounded bg-accent px-2 py-1 text-[12px] text-white"
              >
                {result && !result.ok ? '重试' : '确认撤销'}
              </button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function activeRun(): RunView | undefined {
  const state = useWorkbenchStore.getState()
  return state.activeRunId ? state.runs[state.activeRunId] : undefined
}
