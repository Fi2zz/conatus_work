import type { JSX } from 'react'
import { TaskList } from '@/features/tasks/TaskList'
import { useWorkbench, useWorkbenchStore } from '@/state/workbench-store'

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
        <section data-testid="timeline" className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="text-[12px] text-ink-muted">选择左侧任务查看执行过程。</p>
        </section>
      </main>

      <aside data-testid="right-pane" className="min-h-0 border-l border-line bg-panel">
        <div className="border-b border-line px-3 py-2 text-[12px] font-semibold">产物 / 变更 / 检查点</div>
        <div className="p-3 text-[12px] text-ink-muted">右侧面板接线中。</div>
      </aside>
    </div>
  )
}
