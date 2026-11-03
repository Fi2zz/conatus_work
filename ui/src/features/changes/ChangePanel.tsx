import { useState } from 'react'
import type { JSX } from 'react'

import { getTransport } from '@/bridge/transport-store'
import type { BridgeErrorCode } from '@/bridge/types'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { undoScope } from '@/state/selectors'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench } from '@/state/workbench-store'
import { cn } from '@/lib/utils'
import { DiffView } from './DiffView'

const ERROR_TEXT: Record<BridgeErrorCode, string> = {
  PRUNED: '无法重做：目标轮次已不在保留范围。',
  STALE_TURN: '任务状态已变化，请重试。',
  DENIED: '操作被拒绝。',
  NOT_FOUND: '找不到目标运行或轮次。',
  INTERNAL: '宿主内部错误。',
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'danger' }): JSX.Element {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[10.5px] text-ink-muted">{label}</span>
      <span className={cn('text-[12px] font-semibold tnum', tone === 'danger' && 'text-danger')}>
        {value}
      </span>
    </span>
  )
}

export function ChangePanel(): JSX.Element {
  const run = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId] : undefined))
  const setDialogOpen = useUiStore((state) => state.setUndoDialog)
  const notice = useUiStore((state) => state.undoNotice)
  const [selected, setSelected] = useState<string | null>(null)
  const [redoMessage, setRedoMessage] = useState<string | null>(null)

  if (!run) return <EmptyState title="未选择任务" hint="选一条运行后，这里会列出它改动的文件。" />
  if (!run.changes) {
    return (
      <p data-testid="changes-empty" className="p-4 text-[11.5px] text-ink-muted">
        该运行未记录变更。
      </p>
    )
  }

  const scope = undoScope(run)
  const files = run.changes.files
  const activeFile = files.find((file) => file.to === selected) ?? files[0]
  const activeNotice = notice && notice.runId === run.id ? notice : null

  async function requestRedo(): Promise<void> {
    setRedoMessage(null)
    const result = await getTransport().redo(run!.id, 1)
    if (!result.ok) {
      setRedoMessage(ERROR_TEXT[result.error.code])
      return
    }
    if (!result.value.ok) setRedoMessage(ERROR_TEXT[result.value.code ?? 'INTERNAL'])
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        data-testid="change-summary"
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line/70 px-3 py-2"
      >
        <span className="flex items-center gap-3">
          移动 {run.changes.summary.moved}
          <Stat label="冲突" value={run.changes.summary.quarantined ?? 0} />
          <Stat label="新增" value={run.changes.summary.added} />
          <Stat label="修改" value={run.changes.summary.modified} />
          <Stat label="删除" value={run.changes.summary.deleted} tone="danger" />
        </span>
        <span className="text-[10.5px] text-ink-muted">
          {scope.usable ? `可撤销至轮次 ${scope.targetTurn}` : scope.reason}
        </span>
      </div>

      {activeNotice ? (
        <p
          data-testid="undo-notice"
          className="border-b border-success/30 bg-success/8 px-3 py-1.5 text-[11px] text-success"
        >
          已撤销到轮次 {activeNotice.targetTurn}（回退 {activeNotice.steps} 轮），可以重做。
        </p>
      ) : null}

      {files.length === 0 ? (
        <p data-testid="changes-empty-files" className="p-4 text-[11.5px] text-ink-muted">
          该运行没有文件级变更记录。
        </p>
      ) : (
        <>
          <ul className="max-h-40 overflow-auto border-b border-line/70 py-1">
            {files.map((file) => (
              <li key={file.to}>
                <button
                  type="button"
                  onClick={() => setSelected(file.to)}
                  className={cn(
                    'w-full px-3 py-1 text-left transition-colors duration-[var(--dur-fast)] hover:bg-panel-muted',
                    activeFile?.to === file.to && 'bg-panel-muted',
                  )}
                >
                  <span className="block truncate font-mono text-[11px]">{file.to}</span>
                  <span className="block truncate font-mono text-[10px] text-ink-faint">← {file.from}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {activeFile ? <DiffView from={activeFile.from} to={activeFile.to} /> : null}
          </div>
        </>
      )}

      {redoMessage ? (
        <p
          data-testid="undo-pruned"
          className="border-t border-warning/30 bg-warning/10 px-3 py-1 text-[10.5px] text-warning"
        >
          {redoMessage}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-line/70 px-3 py-2">
        <Button size="sm" data-testid="redo-button" onClick={() => void requestRedo()}>
          重做
        </Button>
        <Button
          size="sm"
          variant="primary"
          data-testid="undo-button"
          disabled={!scope.usable}
          onClick={() => setDialogOpen(true)}
        >
          撤销这批变更
        </Button>
      </div>
    </div>
  )
}
