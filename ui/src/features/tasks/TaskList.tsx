import type { JSX } from 'react'

import type { RunSummary } from '@/bridge/types'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

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

function dayOf(startedAt: string): string {
  return startedAt.slice(0, 10)
}

function groupRuns(runs: RunSummary[]): Array<[string, RunSummary[]]> {
  if (runs.length === 0) return []
  const newest = runs.map((run) => dayOf(run.startedAt)).sort().at(-1) ?? ''
  const recent = runs.filter((run) => dayOf(run.startedAt) === newest)
  const older = runs.filter((run) => dayOf(run.startedAt) !== newest)
  return [
    ['今天', recent],
    ['更早', older],
  ].filter(([, list]) => (list as RunSummary[]).length > 0) as Array<[string, RunSummary[]]>
}

function duration(run: RunSummary): string {
  if (!run.endedAt) return '进行中'
  const ms = Date.parse(run.endedAt) - Date.parse(run.startedAt)
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const minutes = ms / 60000
  return minutes < 1 ? `${Math.max(1, Math.round(ms / 1000))}s` : `${minutes.toFixed(1)}m`
}

export function TaskList({ runs, activeId, onSelect, loading = false }: TaskListProps): JSX.Element {
  if (loading) return <Skeleton rows={5} />
  if (runs.length === 0) {
    return (
      <div data-testid="task-list-empty">
        <EmptyState
          compact
          title="还没有任务"
          hint="点「新任务」挑一张任务卡，跑起来后会出现在这里。"
        />
      </div>
    )
  }

  return (
    <div data-testid="task-list" className="flex flex-col gap-4 overflow-y-auto px-2 py-3">
      {groupRuns(runs).map(([label, group]) => (
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
                  'rise group relative rounded-md px-2 py-1.5 text-left transition-colors duration-[var(--dur-fast)]',
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
  )
}
