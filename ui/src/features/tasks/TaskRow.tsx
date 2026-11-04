import type { JSX } from 'react'

import type { RunSummary } from '@/bridge/types'
import { cn } from '@/lib/utils'
import { STATUS, duration } from './task-list-helpers'

interface TaskRowProps {
  run: RunSummary
  active: boolean
  index: number
  pinned: boolean
  onSelect: (runId: string) => void
  onTogglePin: (runId: string) => void
}

export function TaskRow({
  run,
  active,
  index,
  pinned,
  onSelect,
  onTogglePin,
}: TaskRowProps): JSX.Element {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onSelect(run.id)}
        style={{ animationDelay: `${Math.min(index, 8) * 18}ms` }}
        className={cn(
          'rise relative w-full rounded-md px-2 py-1.5 pr-7 text-left transition-colors duration-[var(--dur-fast)]',
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
      <button
        type="button"
        data-testid="pin-task"
        aria-label={pinned ? '取消置顶' : '置顶任务'}
        aria-pressed={pinned}
        onClick={() => onTogglePin(run.id)}
        className={cn(
          'absolute top-1 right-1 rounded-sm px-1 text-[11px] transition-opacity',
          pinned ? 'text-accent opacity-100' : 'text-ink-faint opacity-0 group-hover:opacity-100',
        )}
      >
        {pinned ? '★' : '☆'}
      </button>
    </div>
  )
}
