import { useEffect, useRef, useState } from 'react'
import type { JSX, PointerEvent as ReactPointerEvent } from 'react'

import { getTransport, hasTransport } from '@/bridge/transport-store'
import type { TaskCard } from '@/bridge/types'
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

const RAIL_WIDTH = 56
const LIST_WIDTH = 240
const DEFAULT_RIGHT = 380

function clampWidth(width: number): number {
  return Math.min(560, Math.max(320, width))
}

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

function NewTaskDialog(): JSX.Element {
  const open = useUiStore((state) => state.newTaskOpen)
  const setOpen = useUiStore((state) => state.setNewTaskOpen)
  const adoptRun = useWorkbenchStore((store) => store.adoptRun)
  const [cards, setCards] = useState<TaskCard[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !hasTransport()) return
    void getTransport()
      .listCards()
      .then((result) => {
        if (result.ok) setCards(result.value)
        else setError(result.error.message)
      })
      .catch((cause: unknown) => setError(String(cause)))
  }, [open])

  async function pick(card: TaskCard): Promise<void> {
    setOpen(false)
    setError(null)
    const started = await getTransport().startTask(card.id)
    if (!started.ok) {
      setError(started.error.message)
      setOpen(true)
      return
    }
    const view = await getTransport().openTask(started.value.runId)
    if (view.ok) adoptRun(view.value)
  }

  if (!open) return <></>
  return (
    <Dialog open onOpenChange={setOpen}>
      <DialogContent labelledBy="new-task-title">
        <DialogTitle id="new-task-title">新任务</DialogTitle>
        <div data-testid="new-task-dialog">
          {error ? <p className="mb-2 text-[12px] text-danger">{error}</p> : null}
          {cards.length === 0 ? (
            <p className="text-[12px] text-ink-muted">没有可用的任务卡。</p>
          ) : (
            <ul className="max-h-72 overflow-auto">
              {cards.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => void pick(card)}
                    className="w-full rounded px-2 py-1 text-left text-[12px] hover:bg-panel-muted"
                  >
                    <span className="block truncate">{card.title}</span>
                    <span className="block truncate text-[10.5px] text-ink-muted">
                      {card.chain} · {card.id}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
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

function LeftRail(): JSX.Element {
  const runs = useWorkbench((state) => state.runs)
  const order = useWorkbench((state) => state.order)
  const activeRunId = useWorkbench((state) => state.activeRunId)
  const setActive = useWorkbenchStore((store) => store.setActive)
  return (
    <aside
      data-testid="left-rail"
      className="flex min-h-0 flex-col items-center gap-2 border-r border-line bg-panel-muted py-2"
    >
      {order.map((id) => (
        <button
          key={id}
          type="button"
          title={runs[id]?.title ?? id}
          onClick={() => setActive(id)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded text-[11px]',
            id === activeRunId ? 'bg-panel text-ink' : 'text-ink-muted hover:bg-panel',
          )}
        >
          {runs[id]?.title.slice(0, 1) ?? '·'}
        </button>
      ))}
    </aside>
  )
}

function Splitter(): JSX.Element {
  const rightWidth = useUiStore((state) => state.rightWidth)
  const setRightWidth = useUiStore((state) => state.setRightWidth)
  const drag = useRef<{ startX: number; startWidth: number } | null>(null)

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    drag.current = { startX: event.clientX, startWidth: rightWidth }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!drag.current) return
    setRightWidth(clampWidth(drag.current.startWidth - (event.clientX - drag.current.startX)))
  }

  function onPointerUp(): void {
    drag.current = null
  }

  return (
    <div
      data-testid="right-splitter"
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => setRightWidth(DEFAULT_RIGHT)}
      className="w-1 cursor-col-resize bg-line/60 hover:bg-accent/60"
    />
  )
}

export function Shell(): JSX.Element {
  const order = useWorkbench((state) => state.order)
  const runs = useWorkbench((state) => state.runs)
  const activeRunId = useWorkbench((state) => state.activeRunId)
  const setActive = useWorkbenchStore((store) => store.setActive)
  const adoptRun = useWorkbenchStore((store) => store.adoptRun)
  const setCommandOpen = useUiStore((state) => state.setCommandOpen)
  const setUndoDialog = useUiStore((state) => state.setUndoDialog)
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen)
  const setNewTaskOpen = useUiStore((state) => state.setNewTaskOpen)
  const leftCollapsed = useUiStore((state) => state.leftCollapsed)
  const toggleLeft = useUiStore((state) => state.toggleLeft)
  const rightWidth = useUiStore((state) => state.rightWidth)

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

  function selectTask(runId: string): void {
    setActive(runId)
    const existing = runs[runId]
    if (!hasTransport() || (existing && existing.timeline.length > 0)) return
    void getTransport()
      .openTask(runId)
      .then((result) => {
        if (result.ok) adoptRun(result.value)
      })
      .catch(() => undefined)
  }

  const summaries = order.map((id) => runs[id]).filter(Boolean)
  const active = activeRunId ? runs[activeRunId] : undefined
  const running = active?.status === 'running' || active?.status === 'pending'
  const retryable = active?.status === 'failed' || active?.status === 'aborted'

  async function stop(): Promise<void> {
    if (!active) return
    await getTransport().cancelTask(active.id)
  }

  async function retry(): Promise<void> {
    if (!active) return
    const result = await getTransport().startTask(active.taskId)
    if (result.ok) setActive(result.value.runId)
  }

  return (
    <div
      data-testid="shell"
      className="grid h-full bg-canvas text-ink"
      style={{
        gridTemplateColumns: `${leftCollapsed ? RAIL_WIDTH : LIST_WIDTH}px minmax(0,1fr) 4px ${rightWidth}px`,
      }}
    >
      <aside className="flex min-h-0 flex-col border-r border-line bg-panel-muted">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          {leftCollapsed ? null : <span className="text-[12px] font-semibold">工作台</span>}
          <button
            type="button"
            data-testid="left-toggle"
            onClick={toggleLeft}
            className="rounded border border-line bg-panel px-1.5 py-0.5 text-[11px] text-ink-muted"
          >
            {leftCollapsed ? '»' : '«'}
          </button>
          {leftCollapsed ? null : (
            <button
              type="button"
              data-testid="new-task-button"
              onClick={() => setNewTaskOpen(true)}
              className="rounded border border-line bg-panel px-1.5 py-0.5 text-[11px]"
            >
              新任务
            </button>
          )}
        </div>
        {leftCollapsed ? (
          <LeftRail />
        ) : (
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
            onSelect={selectTask}
          />
        )}
        <div className="mt-auto flex items-center justify-between border-t border-line px-3 py-2 text-[11px] text-ink-muted">
          <button type="button" onClick={() => setSettingsOpen(true)} className="hover:text-ink">
            设置
          </button>
          {leftCollapsed ? null : (
            <span data-testid="undo-scope-label">可撤销 {active ? undoScope(active).steps : 0} 轮</span>
          )}
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
            {running ? (
              <button
                type="button"
                data-testid="stop-button"
                onClick={() => void stop()}
                className="rounded border border-line px-1.5 py-0.5 text-[11px]"
              >
                停止
              </button>
            ) : null}
            {retryable ? (
              <button
                type="button"
                data-testid="retry-button"
                onClick={() => void retry()}
                className="rounded border border-line px-1.5 py-0.5 text-[11px]"
              >
                重试
              </button>
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

      <Splitter />
      <RightPane />
      <CommandPalette />
      <NewTaskDialog />
      <SettingsDialog />
      <UndoDialogHost />
    </div>
  )
}
