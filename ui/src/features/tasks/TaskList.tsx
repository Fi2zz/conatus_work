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
  const setQuery = useUiStore((state) => state.setTaskQuery)
  const setStatus = useUiStore((state) => state.setTaskStatus)
  const setTime = useUiStore((state) => state.setTaskTime)
  const togglePin = useUiStore((state) => state.togglePinnedTask)
  const setTaskTitle = useUiStore((state) => state.setTaskTitle)
  const archiveTask = useUiStore((state) => state.archiveTask)

  if (loading) return <Skeleton rows={5} />
  if (runs.length === 0) {
    return (
      <div data-testid="task-list-empty">
        <EmptyState compact title="还没有任务" hint="点「新任务」挑一张任务卡，跑起来后会出现在这里。" />
      </div>
    )
  }

  const needle = query.trim().toLowerCase()
  const decorated = runs
    .filter((run) => !archived.includes(run.id))
    .map((run) => (titles[run.id] ? { ...run, title: titles[run.id] } : run))
  const visible = decorated.filter((run) => {
    if (!matchesStatus(run, status) || !matchesTime(run, time)) return false
    if (needle === '') return true
    return `${run.title} ${run.taskId} ${run.chain}`.toLowerCase().includes(needle)
  })
  const pinnedIds = new Set(pinned)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TaskFilters count={visible.length} />

      {visible.length === 0 ? (
        <div data-testid="task-list-filtered-empty">
          <EmptyState
            compact
            title="没有匹配的任务"
            hint="换个关键词或筛选条件试试。"
            action={
              <Button
                size="sm"
                onClick={() => {
                  setQuery('')
                  setStatus('all')
                  setTime('all')
                }}
              >
                清除筛选
              </Button>
            }
          />
        </div>
      ) : (
        <div data-testid="task-list" className="flex flex-col gap-4 overflow-y-auto px-2 py-3">
          {groupRuns(visible, pinnedIds).map(([label, group]) => (
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
                  onSelect={onSelect}
                  onTogglePin={togglePin}
                  onRename={setTaskTitle}
                  onArchive={archiveTask}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
