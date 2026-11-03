import type { JSX } from 'react'

import type { RunSummary } from '@/bridge/types'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useUiStore, type TaskStatusFilter } from '@/state/ui-state'

interface TaskListProps {
  runs: RunSummary[]
  activeId: string | null
  onSelect: (runId: string) => void
  loading?: boolean
}

const STATUS: Record<RunSummary['status'], { dot: string; label: string }> = {
  pending: { dot: 'bg-ink-faint', label: '等待' },
  running: { dot: 'bg-accent dot-live', label: '运行中' },
  succeeded: { dot: 'bg-success', label: '完成' },
  failed: { dot: 'bg-danger', label: '失败' },
  aborted: { dot: 'bg-ink-faint', label: '中断' },
}

const FILTERS: Array<{ value: TaskStatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'running', label: '进行中' },
  { value: 'failed', label: '失败' },
]

function matchesStatus(run: RunSummary, filter: TaskStatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'running') return run.status === 'running' || run.status === 'pending'
  return run.status === 'failed' || run.status === 'aborted'
}

function dayOf(startedAt: string): string {
  return startedAt.slice(0, 10)
}

function groupRuns(runs: RunSummary[]): Array<[string, RunSummary[]]> {
  if (runs.length === 0) return []
  const days = [...new Set(runs.map((run) => dayOf(run.startedAt)))].sort().reverse()
  const olderDays = new Set(days.slice(2))
  const groups: Array<[string, RunSummary[]]> = []
  if (days[0]) groups.push(['今天', runs.filter((run) => dayOf(run.startedAt) === days[0])])
  if (days[1]) groups.push(['昨天', runs.filter((run) => dayOf(run.startedAt) === days[1])])
  const older = runs.filter((run) => olderDays.has(dayOf(run.startedAt)))
  if (older.length > 0) groups.push(['更早', older])
  return groups
}

function duration(run: RunSummary): string {
  if (!run.endedAt) return '进行中'
  const ms = Date.parse(run.endedAt) - Date.parse(run.startedAt)
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const minutes = ms / 60000
  return minutes < 1 ? `${Math.max(1, Math.round(ms / 1000))}s` : `${minutes.toFixed(1)}m`
}

export function TaskList({ runs, activeId, onSelect, loading = false }: TaskListProps): JSX.Element {
  const query = useUiStore((state) => state.taskQuery)
  const status = useUiStore((state) => state.taskStatus)
  const setQuery = useUiStore((state) => state.setTaskQuery)
  const setStatus = useUiStore((state) => state.setTaskStatus)

  if (loading) return <Skeleton rows={5} />
  if (runs.length === 0) {
    return (
      <div data-testid="task-list-empty">
        <EmptyState compact title="还没有任务" hint="点「新任务」挑一张任务卡，跑起来后会出现在这里。" />
      </div>
    )
  }

  const needle = query.trim().toLowerCase()
  const visible = runs.filter((run) => {
    if (!matchesStatus(run, status)) return false
    if (needle === '') return true
    return `${run.title} ${run.taskId} ${run.chain}`.toLowerCase().includes(needle)
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-1.5 border-b border-line/70 px-2 py-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索任务"
          className="h-6 w-full rounded-md border border-line bg-panel px-2 text-[11.5px] outline-none placeholder:text-ink-faint focus:border-accent/60"
        />
        <div className="flex items-center gap-0.5">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={status === item.value}
              onClick={() => setStatus(item.value)}
              className={cn(
                'flex-1 rounded-sm px-1 py-0.5 text-[10.5px] transition-colors duration-[var(--dur-fast)]',
                status === item.value ? 'bg-panel text-ink shadow-panel' : 'text-ink-muted hover:text-ink',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div data-testid="task-list-filtered-empty">
          <EmptyState
            compact
            title="没有匹配的任务"
            hint="换个关键词或结局筛选试试。"
            action={
              <Button
                size="sm"
                onClick={() => {
                  setQuery('')
                  setStatus('all')
                }}
              >
                清除筛选
              </Button>
            }
          />
        </div>
      ) : (
        <div data-testid="task-list" className="flex flex-col gap-4 overflow-y-auto px-2 py-3">
          {groupRuns(visible).map(([label, group]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <div className="label-micro px-2 pb-1">{label}</div>
              {group.map((run, index) => {
                const active = run.id === activeId
                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => onSelect(run.id)}
                    style={{ animationDelay: `${Math.min(index, 8) * 18}ms` }}
                    className={cn(
                      'rise relative rounded-md px-2 py-1.5 text-left transition-colors duration-[var(--dur-fast)]',
                      active ? 'bg-panel shadow-panel' : 'hover:bg-panel/70',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'absolute inset-y-1.5 left-0 w-[2px] rounded-full transition-colors',
                        active ? 'bg-accent' : 'bg-transparent',
                      )}
                    />
                    <div className="flex items-center gap-1.5 pl-1.5">
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS[run.status].dot)} />
                      <span className="truncate text-[12.5px] leading-snug">{run.title}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 pl-4 text-[10.5px] text-ink-muted tnum">
                      <span>{STATUS[run.status].label}</span>
                      <span className="text-ink-faint">·</span>
                      <span>{duration(run)}</span>
                      <span className="text-ink-faint">·</span>
                      <span>${run.usage.costUsd.toFixed(4)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
