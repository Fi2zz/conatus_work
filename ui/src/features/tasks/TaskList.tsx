import type { JSX } from 'react'

import type { RunSummary } from '@/bridge/types'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useUiStore } from '@/state/ui-state'
import { TaskFilters } from './TaskFilters'
import { TaskRow } from './TaskRow'
import { groupRuns, matchesStatus, matchesTime } from './task-list-helpers'

interface TaskListProps {
  runs: RunSummary[]
  activeId: string | null
  onSelect: (runId: string) => void
  loading?: boolean
}

export function TaskList({ runs, activeId, onSelect, loading = false }: TaskListProps): JSX.Element {
  const query = useUiStore((state) => state.taskQuery)
  const status = useUiStore((state) => state.taskStatus)
  const time = useUiStore((state) => state.taskTime)
  const pinned = useUiStore((state) => state.pinnedTaskIds)
  const titles = useUiStore((state) => state.taskTitles)
  const archived = useUiStore((state) => state.archivedTaskIds)
  const batchMode = useUiStore((state) => state.batchMode)
  const selected = useUiStore((state) => state.selectedTaskIds)
  const archiveView = useUiStore((state) => state.archiveView)
  const grouping = useUiStore((state) => state.taskGrouping)
  const setQuery = useUiStore((state) => state.setTaskQuery)
  const setStatus = useUiStore((state) => state.setTaskStatus)
  const setTime = useUiStore((state) => state.setTaskTime)
  const togglePin = useUiStore((state) => state.togglePinnedTask)
  const setTaskTitle = useUiStore((state) => state.setTaskTitle)
  const archiveTask = useUiStore((state) => state.archiveTask)
  const restoreTask = useUiStore((state) => state.restoreTask)
  const setBatchMode = useUiStore((state) => state.setBatchMode)
  const toggleSelected = useUiStore((state) => state.toggleTaskSelected)
  const clearSelected = useUiStore((state) => state.clearTaskSelection)
  const setArchiveView = useUiStore((state) => state.setArchiveView)
  const setGrouping = useUiStore((state) => state.setTaskGrouping)
  const setNewSessionOpen = useUiStore((state) => state.setNewSessionOpen)
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen)

  if (loading) return <Skeleton rows={5} />
  if (runs.length === 0 && !archiveView) {
    return (
      <div data-testid="task-list-empty" className="p-3">
        <div className="rounded-lg border border-dashed border-line bg-panel/60 p-3">
          <p className="text-[12.5px] font-medium">开始第一个任务</p>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-4 text-[11px] leading-relaxed text-ink-muted">
            <li>点「新任务」选一张任务卡</li>
            <li>在输入框里补充目标、输入和输出格式</li>
            <li>在右栏检查产物、变更与检查点</li>
          </ol>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => setNewSessionOpen(true)}>
              新建任务
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setShortcutsOpen(true)}>
              快捷键
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const needle = query.trim().toLowerCase()
  const archivedSet = new Set(archived)
  const source = runs.filter((run) => (archiveView ? archivedSet.has(run.id) : !archivedSet.has(run.id)))
  const decorated = source.map((run) => (titles[run.id] ? { ...run, title: titles[run.id] } : run))
  const visible = decorated.filter((run) => {
    if (!matchesStatus(run, status) || !matchesTime(run, time)) return false
    if (needle === '') return true
    return `${run.title} ${run.taskId} ${run.chain}`.toLowerCase().includes(needle)
  })
  const pinnedIds = new Set(pinned)
  const selectedIds = new Set(selected)

  function archiveSelected(): void {
    for (const id of selected) archiveTask(id)
    clearSelected()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TaskFilters count={visible.length} />

      <div className="flex items-center gap-1 border-b border-line/70 px-2 py-1 text-[10.5px] text-ink-muted">
        <button
          type="button"
          data-testid="task-batch-toggle"
          aria-pressed={batchMode}
          onClick={() => setBatchMode(!batchMode)}
          className={batchMode ? 'rounded-sm bg-panel px-1.5 py-0.5 text-ink shadow-panel' : 'rounded-sm px-1.5 py-0.5 hover:text-ink'}
        >
          批量
        </button>
        <button
          type="button"
          data-testid="task-archive-toggle"
          aria-pressed={archiveView}
          onClick={() => {
            setArchiveView(!archiveView)
            setBatchMode(false)
          }}
          className={archiveView ? 'rounded-sm bg-panel px-1.5 py-0.5 text-ink shadow-panel' : 'rounded-sm px-1.5 py-0.5 hover:text-ink'}
        >
          归档 {archived.length}
        </button>
        <button
          type="button"
          data-testid="task-grouping-toggle"
          onClick={() => setGrouping(grouping === 'workspace' ? 'date' : 'workspace')}
          className="ml-auto rounded-sm px-1.5 py-0.5 hover:text-ink"
        >
          {grouping === 'workspace' ? '按空间' : '按日期'}
        </button>
      </div>

      {visible.length === 0 ? (
        <div data-testid="task-list-filtered-empty">
          <EmptyState
            compact
            title={archiveView ? '没有归档任务' : '没有匹配的任务'}
            hint={archiveView ? '归档后的任务会出现在这里。' : '换个关键词或筛选条件试试。'}
            action={
              <Button
                size="sm"
                onClick={() => {
                  setQuery('')
                  setStatus('all')
                  setTime('all')
                  setArchiveView(false)
                }}
              >
                {archiveView ? '返回任务' : '清除筛选'}
              </Button>
            }
          />
        </div>
      ) : (
        <div data-testid="task-list" className="flex flex-col gap-4 overflow-y-auto px-2 py-3">
          {groupRuns(visible, pinnedIds, grouping).map(([label, group]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <div data-testid={`task-group-${label}`} className="label-micro px-2 pb-1">
                {label}
              </div>
              {group.map((run, index) => (
                <TaskRow
                  key={run.id}
                  run={run}
                  active={run.id === activeId}
                  index={index}
                  pinned={pinnedIds.has(run.id)}
                  batchMode={batchMode}
                  selected={selectedIds.has(run.id)}
                  archiveView={archiveView}
                  onSelect={onSelect}
                  onTogglePin={togglePin}
                  onToggleSelected={toggleSelected}
                  onRename={setTaskTitle}
                  onArchive={archiveTask}
                  onRestore={restoreTask}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {batchMode ? (
        <div data-testid="task-batch-bar" className="flex items-center gap-2 border-t border-line/70 px-2 py-1.5 text-[11px]">
          <span className="text-ink-muted">已选 {selected.length}</span>
          <span className="flex-1" />
          <Button size="sm" data-testid="batch-archive" disabled={selected.length === 0} onClick={archiveSelected}>
            归档
          </Button>
          <Button size="sm" variant="quiet" onClick={() => setBatchMode(false)}>
            取消
          </Button>
        </div>
      ) : null}
    </div>
  )
}
