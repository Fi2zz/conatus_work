import { useEffect, useRef } from 'react'
import type { JSX, PointerEvent as ReactPointerEvent } from 'react'

import { getTransport, hasTransport } from '@/bridge/transport-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ApprovalBar } from '@/features/approval/ApprovalBar'
import { Composer } from '@/features/conversation/Composer'
import { PlanStrip } from '@/features/conversation/PlanStrip'
import { Timeline } from '@/features/conversation/Timeline'
import { CommandPalette } from '@/features/tasks/CommandPalette'
import { TaskList } from '@/features/tasks/TaskList'
import { UndoDialogHost } from '@/features/changes/UndoDialogHost'
import { cn } from '@/lib/utils'
import { undoScope } from '@/state/selectors'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench, useWorkbenchStore } from '@/state/workbench-store'
import { CompareDialog, NewTaskDialog, SettingsDialog } from './dialogs'
import { RightPane } from './RightPane'

const RAIL_WIDTH = 56
const LIST_WIDTH = 264
const DEFAULT_RIGHT = 380

const STATUS_TONE = {
  pending: 'neutral',
  running: 'accent',
  succeeded: 'success',
  failed: 'danger',
  aborted: 'neutral',
} as const

function clampWidth(width: number): number {
  return Math.min(560, Math.max(320, width))
}

function LeftRail(): JSX.Element {
  const runs = useWorkbench((state) => state.runs)
  const order = useWorkbench((state) => state.order)
  const activeRunId = useWorkbench((state) => state.activeRunId)
  const setActive = useWorkbenchStore((store) => store.setActive)
  return (
    <aside data-testid="left-rail" className="flex min-h-0 flex-col items-center gap-1.5 py-2">
      {order.map((id) => (
        <button
          key={id}
          type="button"
          title={runs[id]?.title ?? id}
          onClick={() => setActive(id)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md text-[11px] transition-colors',
            id === activeRunId ? 'bg-panel text-ink shadow-panel' : 'text-ink-muted hover:bg-panel/70',
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

  return (
    <div
      data-testid="right-splitter"
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={() => setRightWidth(DEFAULT_RIGHT)}
      className="ruler group w-1 cursor-col-resize bg-panel-muted/40 transition-colors hover:bg-accent/10"
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
  const setCompareOpen = useUiStore((state) => state.setCompareOpen)
  const leftCollapsed = useUiStore((state) => state.leftCollapsed)
  const stoppingRunId = useUiStore((state) => state.stoppingRunId)
  const setStoppingRun = useUiStore((state) => state.setStoppingRun)
  const stopping = stoppingRunId !== null && stoppingRunId === activeRunId
  const toggleLeft = useUiStore((state) => state.toggleLeft)
  const rightWidth = useUiStore((state) => state.rightWidth)

  const summaries = order.map((id) => runs[id]).filter(Boolean)
  const active = activeRunId ? runs[activeRunId] : undefined
  const running = active?.status === 'running' || active?.status === 'pending'

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
      if (key === 'n') {
        event.preventDefault()
        setNewTaskOpen(true)
      }
      if (event.key === '.') {
        event.preventDefault()
        void stopActive()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setCommandOpen, setUndoDialog, setNewTaskOpen, running, stopping, active?.id])

  // 运行结束（或切换了任务）就把「停止中」清掉。
  useEffect(() => {
    if (stoppingRunId !== null && !running) setStoppingRun(null)
  }, [stoppingRunId, running, setStoppingRun])

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

  const retryable = active?.status === 'failed' || active?.status === 'aborted'
  const scope = active ? undoScope(active) : { steps: 0, usable: false }

  async function stop(): Promise<void> {
    if (!active || stopping) return
    // 先给即时反馈，等运行真正结束（task/ended）再清掉。
    setStoppingRun(active.id)
    try {
      await getTransport().cancelTask(active.id)
    } catch {
      setStoppingRun(null)
    }
  }

  function stopActive(): void {
    if (!running) return
    void stop()
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
      <aside className="flex min-h-0 flex-col border-r border-line bg-panel-muted/60">
        <div className="flex items-center gap-2 border-b border-line/70 px-2 py-2">
          <button
            type="button"
            data-testid="left-toggle"
            onClick={toggleLeft}
            aria-label={leftCollapsed ? '展开任务列表' : '折叠任务列表'}
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-panel hover:text-ink"
          >
            {leftCollapsed ? '»' : '«'}
          </button>
          {leftCollapsed ? null : (
            <>
              <span className="label-micro flex-1">任务</span>
              <Button
                size="sm"
                variant="quiet"
                data-testid="new-task-button"
                onClick={() => setNewTaskOpen(true)}
              >
                新任务
              </Button>
            </>
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
            loading={order.length === 0 && hasTransport()}
          />
        )}
        <div className="mt-auto flex items-center justify-between border-t border-line/70 px-2.5 py-1.5 text-[10.5px] text-ink-muted">
          <button type="button" onClick={() => setSettingsOpen(true)} className="hover:text-ink">
            设置
          </button>
          {leftCollapsed ? null : (
            <span data-testid="undo-scope-label" className="tnum">
              可撤销 {scope.steps} 轮
            </span>
          )}
        </div>
      </aside>

      <main className="flex min-h-0 flex-col">
        <header
          data-testid="run-header"
          className="flex items-center justify-between gap-3 border-b border-line/70 bg-panel px-4 py-2"
        >
          <div className="flex min-w-0 items-center gap-2">
            <h1 data-testid="run-title" className="truncate text-[13.5px] font-semibold tracking-[-0.01em]">
              {active?.title ?? '未选择任务'}
            </h1>
            {active?.synthetic ? <Badge tone="warning">合成数据</Badge> : null}
            {active ? <Badge tone={STATUS_TONE[active.status]} dot>{active.status}</Badge> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-[10.5px] text-ink-faint tnum sm:inline">
              {active ? `${active.model} · $${active.usage.costUsd.toFixed(4)}` : ''}
            </span>
            <Button
              size="sm"
              variant="ghost"
              data-testid="compare-button"
              onClick={() => setCompareOpen(true)}
            >
              对比
            </Button>
            {running ? (
              <Button
                size="sm"
                variant="danger"
                data-testid="stop-button"
                aria-label="停止运行（⌘.）"
                title="停止运行（⌘.）"
                disabled={stopping}
                onClick={() => void stop()}
              >
                <span aria-hidden className="text-[9px] leading-none">
                  ■
                </span>
                {stopping ? '停止中…' : '停止'}
              </Button>
            ) : null}
            {retryable ? (
              <Button size="sm" data-testid="retry-button" onClick={() => void retry()}>
                重试
              </Button>
            ) : null}
          </div>
        </header>
        {active?.plan && active.plan.length > 0 ? <PlanStrip plan={active.plan} /> : null}
        <section data-testid="timeline" className="min-h-0 flex-1">
          <Timeline />
        </section>
        {active?.approval ? <ApprovalBar request={active.approval} /> : null}
        <Composer />
      </main>

      <Splitter />
      <RightPane />
      <CommandPalette />
      <NewTaskDialog />
      <CompareDialog />
      <SettingsDialog />
      <UndoDialogHost />
    </div>
  )
}
