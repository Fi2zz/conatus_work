import { useEffect, useRef, useState } from 'react'
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
import { ShortcutsDialog } from '@/features/help/ShortcutsDialog'
import { UsageDialog } from '@/features/usage/UsageDialog'
import { cn } from '@/lib/utils'
import { readRestoreLast } from '@/lib/preferences'
import { useViewportWidth } from '@/lib/viewport'
import { undoScope } from '@/state/selectors'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench, useWorkbenchStore } from '@/state/workbench-store'
import { CompareDialog, NewTaskDialog } from './dialogs'
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
  const setNewTaskOpen = useUiStore((state) => state.setNewTaskOpen)
  const setCompareOpen = useUiStore((state) => state.setCompareOpen)
  const setUsageOpen = useUiStore((state) => state.setUsageOpen)
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen)
  const leftCollapsed = useUiStore((state) => state.leftCollapsed)
  const viewport = useViewportWidth()
  const narrow = viewport < 1000
  const showList = !leftCollapsed && !narrow
  const stoppingRunId = useUiStore((state) => state.stoppingRunId)
  const setStoppingRun = useUiStore((state) => state.setStoppingRun)
  const stopping = stoppingRunId !== null && stoppingRunId === activeRunId
  const toggleLeft = useUiStore((state) => state.toggleLeft)
  const rightWidth = useUiStore((state) => state.rightWidth)
  const rightPx = viewport < 900 ? Math.min(rightWidth, 320) : rightWidth
  const [stopError, setStopError] = useState<string | null>(null)

  const summaries = order.map((id) => runs[id]).filter(Boolean)
  const active = activeRunId ? runs[activeRunId] : undefined
  const running = active?.status === 'running' || active?.status === 'pending'
  const hostMode = hasTransport() && getTransport().mode === 'host'
  const forceable = hostMode && active?.status === 'aborted' && active.endedAt === undefined

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === '?') {
        event.preventDefault()
        setShortcutsOpen(true)
        return
      }
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

  const restoreLast = readRestoreLast()
  useEffect(() => {
    if (!restoreLast || activeRunId || order.length === 0) return
    setActive(order[0])
  }, [restoreLast, activeRunId, order, setActive])

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
    const runId = active.id
    const previous = active.status
    // 先乐观标记为 aborted，再等宿主确认；否则要等 runner 收尾才看到「停止」生效。
    setStoppingRun(runId)
    useWorkbenchStore.getState().setStatus(runId, 'aborted')
    try {
      const result = await getTransport().cancelTask(runId)
      if (result.ok) {
        useWorkbenchStore.getState().setStatus(runId, result.value.status)
      } else {
        useWorkbenchStore.getState().setStatus(runId, previous)
        setStoppingRun(null)
      }
    } catch {
      useWorkbenchStore.getState().setStatus(runId, previous)
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

  async function forceKill(runId: string): Promise<void> {
    const kill = getTransport().killTask
    if (!kill) {
      setStopError('当前宿主不支持强制停止。')
      return
    }
    setStopError(null)
    try {
      const result = await kill.call(getTransport(), runId)
      if (!result.ok) {
        setStopError(result.error.message)
        return
      }
      useWorkbenchStore.getState().finishRun(runId, result.value.status)
    } catch (cause) {
      setStopError(String(cause))
    }
  }

  return (
    <div
      data-testid="shell"
      className="grid h-full min-w-[720px] bg-canvas text-ink"
      style={{
        gridTemplateColumns: `${showList ? LIST_WIDTH : RAIL_WIDTH}px minmax(0,1fr) 4px ${rightPx}px`,
      }}
    >
      <aside className="flex min-h-0 flex-col border-r border-line bg-panel-muted/60">
        <div className="flex items-center gap-2 border-b border-line/70 px-2 py-2">
          <button
            type="button"
            data-testid="left-toggle"
            onClick={toggleLeft}
            disabled={narrow}
            title={narrow ? '窗口较窄，任务列表已自动收起' : undefined}
            aria-label={showList ? '折叠任务列表' : '展开任务列表'}
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-panel hover:text-ink disabled:opacity-40"
          >
            {showList ? '«' : '»'}
          </button>
          {showList ? (
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
          ) : null}
        </div>
        {showList ? (
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
        ) : (
          <LeftRail />
        )}
        <div className="mt-auto flex items-center justify-between border-t border-line/70 px-2.5 py-1.5 text-[10.5px] text-ink-muted">
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="usage-button"
              onClick={() => setUsageOpen(true)}
              className="hover:text-ink"
            >
              用量
            </button>
            <button
              type="button"
              data-testid="shortcuts-button"
              aria-label="快捷键"
              onClick={() => setShortcutsOpen(true)}
              className="hover:text-ink"
            >
              ?
            </button>
          </div>
          {showList ? (
            <span data-testid="undo-scope-label" className="tnum">
              可撤销 {scope.steps} 轮
            </span>
          ) : null}
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
            {narrow ? null : (
              <span className="hidden text-[10.5px] text-ink-faint tnum sm:inline">
                {active ? `${active.model} · $${active.usage.costUsd.toFixed(4)}` : ''}
              </span>
            )}
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
            {forceable ? (
              <Button size="sm" variant="danger" data-testid="force-stop" onClick={() => void forceKill(active.id)}>
                强制停止
              </Button>
            ) : null}
          </div>
        </header>
        {stopError ? (
          <p data-testid="force-stop-error" className="border-b border-danger/30 bg-danger/5 px-4 py-1 text-[10.5px] text-danger">
            {stopError}
          </p>
        ) : null}
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
      <UsageDialog />
      <ShortcutsDialog />
      <UndoDialogHost />
    </div>
  )
}
