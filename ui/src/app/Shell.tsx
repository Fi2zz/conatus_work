import type { JSX } from 'react'

import { ArtifactPanel } from '@/features/artifacts/ArtifactPanel'
import { ChangePanel } from '@/features/changes/ChangePanel'
import { Timeline } from '@/features/conversation/Timeline'
import { TaskList } from '@/features/tasks/TaskList'
import { cn } from '@/lib/utils'
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
            className={cn(
              'pb-1.5',
              tab === item.value ? 'border-b-2 border-accent text-ink' : 'text-ink-muted',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {tab === 'artifacts' ? <ArtifactPanel /> : null}
        {tab === 'changes' ? <ChangePanel /> : null}
        {tab === 'checkpoints' ? <p className="p-3 text-[12px] text-ink-muted">检查点面板接线中。</p> : null}
      </div>
    </aside>
  )
}

export function Shell(): JSX.Element {
  const order = useWorkbench((state) => state.order)
  const runs = useWorkbench((state) => state.runs)
  const activeRunId = useWorkbench((state) => state.activeRunId)
  const setActive = useWorkbenchStore((store) => store.setActive)

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
          <span>设置</span>
          <span data-testid="undo-scope-label">
            可撤销 {Math.max(0, active?.checkpoints.turns.length ?? 0)} 轮
          </span>
        </div>
      </aside>

      <main className="flex min-h-0 flex-col">
        <header className="flex items-baseline justify-between border-b border-line bg-panel px-4 py-2">
          <h1 data-testid="run-title" className="truncate text-[13px] font-semibold">
            {active?.title ?? '未选择任务'}
          </h1>
          <span className="text-[11px] text-ink-muted">
            {active ? `${active.status} · ${active.model} · $${active.usage.costUsd.toFixed(4)}` : ''}
          </span>
        </header>
        <section data-testid="timeline" className="min-h-0 flex-1">
          <Timeline />
        </section>
      </main>

      <RightPane />
    </div>
  )
}
