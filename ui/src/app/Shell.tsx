import { useEffect } from 'react'
import type { JSX } from 'react'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ApprovalBar } from '@/features/approval/ApprovalBar'
import { ArtifactPanel } from '@/features/artifacts/ArtifactPanel'
import { ChangePanel } from '@/features/changes/ChangePanel'
import { UndoDialogHost } from '@/features/changes/UndoDialogHost'
import { CheckpointPanel } from '@/features/checkpoints/CheckpointPanel'
import { Composer } from '@/features/conversation/Composer'
import { Timeline } from '@/features/conversation/Timeline'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { CommandPalette } from '@/features/tasks/CommandPalette'
import { TaskList } from '@/features/tasks/TaskList'
import { cn } from '@/lib/utils'
import { undoScope } from '@/state/selectors'
import { useUiStore, type RightTab } from '@/state/ui-state'
import { useWorkbench, useWorkbenchStore } from '@/state/workbench-store'

const TABS: Array<{ value: RightTab; label: string }> = [
  { value: 'artifacts', label: '产物' },
  { value: 'changes', label: '变更' },
  { value: 'checkpoints', label: '检查点' },
]

function RightPane(): JSX.Element {
  const tab = useUiStore((state) => state.rightTab)
  const setTab = useUiStore((state) => state.setRightTab)
  return (
    <aside data-testid="right-pane" className="flex min-h-0 flex-col border-l border-line bg-panel">
      <div className="flex gap-3 border-b border-line px-3 pt-2 text-[12px]">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={cn('pb-1.5', tab === item.value ? 'border-b-2 border-accent text-ink' : 'text-ink-muted')}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {tab === 'artifacts' ? <ArtifactPanel /> : null}
        {tab === 'changes' ? <ChangePanel /> : null}
        {tab === 'checkpoints' ? <CheckpointPanel /> : null}
      </div>
    </aside>
  )
}

function SettingsDialog(): JSX.Element {
  const open = useUiStore((state) => state.settingsOpen)
  const setOpen = useUiStore((state) => state.setSettingsOpen)
  if (!open) return <></>
  return (
    <Dialog open onOpenChange={setOpen}>
      <DialogContent labelledBy="settings-title">
        <DialogTitle id="settings-title">设置</DialogTitle>
        <SettingsPage />
      </DialogContent>
    </Dialog>
  )
}

export function Shell(): JSX.Element {
  const order = useWorkbench((state) => state.order)
  const runs = useWorkbench((state) => state.runs)
  const activeRunId = useWorkbench((state) => state.activeRunId)
  const setActive = useWorkbenchStore((store) => store.setActive)
  const setCommandOpen = useUiStore((state) => state.setCommandOpen)
  const setUndoDialog = useUiStore((state) => state.setUndoDialog)
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (!(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()
      if (key === 'k') {
        event.preventDefault()
        setCommandOpen(true)
      }
      if (key === 'z') {
        event.preventDefault()
        setUndoDialog(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setCommandOpen, setUndoDialog])

  const summaries = order.map((id) => runs[id]).filter(Boolean)
  const active = activeRunId ? runs[activeRunId] : undefined

  return (
    <div className="grid h-full grid-cols-[240px_minmax(0,1fr)_380px] bg-canvas text-ink">
      <aside className="flex min-h-0 flex-col border-r border-line bg-panel-muted">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <span className="text-[12px] font-semibold">工作台</span>
          <button type="button" className="rounded border border-line bg-panel px-1.5 py-0.5 text-[11px]">
            新任务
          </button>
        </div>
        <TaskList
          runs={summaries.map((run) => ({
            id: run.id,
            taskId: run.taskId,
            title: run.title,
            chain: run.chain,
            status: run.status,
            model: run.model,
            startedAt: run.startedAt,
            endedAt: run.endedAt,
            usage: run.usage,
          }))}
          activeId={activeRunId}
          onSelect={setActive}
        />
        <div className="mt-auto flex items-center justify-between border-t border-line px-3 py-2 text-[11px] text-ink-muted">
          <button type="button" onClick={() => setSettingsOpen(true)} className="hover:text-ink">
            设置
          </button>
          <span data-testid="undo-scope-label">可撤销 {active ? undoScope(active).steps : 0} 轮</span>
        </div>
      </aside>

      <main className="flex min-h-0 flex-col">
        <header
          data-testid="run-header"
          className="flex items-baseline justify-between border-b border-line bg-panel px-4 py-2"
        >
          <h1 data-testid="run-title" className="truncate text-[13px] font-semibold">
            {active?.title ?? '未选择任务'}
          </h1>
          <span className="flex items-center gap-2 text-[11px] text-ink-muted">
            {active?.synthetic ? (
              <span className="rounded border border-warning/50 px-1 text-[10px] text-warning">合成数据</span>
            ) : null}
            {active ? `${active.status} · ${active.model} · $${active.usage.costUsd.toFixed(4)}` : ''}
          </span>
        </header>
        <section data-testid="timeline" className="min-h-0 flex-1">
          <Timeline />
        </section>
        {active?.approval ? <ApprovalBar runId={active.id} request={active.approval} /> : null}
        <Composer />
      </main>

      <RightPane />
      <CommandPalette />
      <SettingsDialog />
      <UndoDialogHost />
    </div>
  )
}
