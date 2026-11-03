import type { JSX } from 'react'
import type { RunSummary } from '@/bridge/types'
import { cn } from '@/lib/utils'

interface TaskListProps {
  runs: RunSummary[]
  activeId: string | null
  onSelect: (runId: string) => void
}

const STATUS_DOT: Record<RunSummary['status'], string> = {
  pending: 'bg-ink-muted',
  running: 'bg-accent animate-pulse',
  succeeded: 'bg-success',
  failed: 'bg-danger',
  aborted: 'bg-ink-muted',
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

function minutesOf(run: RunSummary): string {
  if (!run.endedAt) return '进行中'
  const ms = Date.parse(run.endedAt) - Date.parse(run.startedAt)
  if (!Number.isFinite(ms) || ms < 0) return '—'
  return `${Math.max(1, Math.round(ms / 60000))} min`
}

export function TaskList({ runs, activeId, onSelect }: TaskListProps): JSX.Element {
  if (runs.length === 0) {
    return (
      <div data-testid="task-list-empty" className="p-4 text-ink-muted">
        还没有任务。
      </div>
    )
  }

  return (
    <div data-testid="task-list" className="flex flex-col gap-3 overflow-y-auto p-2">
      {groupRuns(runs).map(([label, group]) => (
        <div key={label} className="flex flex-col gap-1">
          <div className="px-2 text-[11px] uppercase tracking-wide text-ink-muted">{label}</div>
          {group.map((run) => (
            <button
              key={run.id}
              type="button"
              onClick={() => onSelect(run.id)}
              className={cn(
                'rounded-md border border-transparent px-2 py-1.5 text-left hover:bg-panel-muted',
                run.id === activeId && 'border-line bg-panel',
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[run.status])} />
                <span className="truncate text-[12.5px]">{run.title}</span>
              </div>
              <div className="mt-0.5 truncate pl-3 text-[11px] text-ink-muted">
                {run.model} · {minutesOf(run)} · ${run.usage.costUsd.toFixed(4)}
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
