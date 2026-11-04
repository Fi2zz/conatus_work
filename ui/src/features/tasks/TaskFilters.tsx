import type { JSX, ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { useUiStore } from '@/state/ui-state'
import { STATUS_FILTERS, TIME_FILTERS } from './task-list-helpers'

function ChipGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}): JSX.Element {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-0.5">
      {children}
    </div>
  )
}

export function TaskFilters({ count }: { count: number }): JSX.Element {
  const query = useUiStore((state) => state.taskQuery)
  const status = useUiStore((state) => state.taskStatus)
  const time = useUiStore((state) => state.taskTime)
  const setQuery = useUiStore((state) => state.setTaskQuery)
  const setStatus = useUiStore((state) => state.setTaskStatus)
  const setTime = useUiStore((state) => state.setTaskTime)

  const chip = (active: boolean): string =>
    cn(
      'flex-1 rounded-sm px-1 py-0.5 text-[10.5px] transition-colors duration-[var(--dur-fast)]',
      active ? 'bg-panel text-ink shadow-panel' : 'text-ink-muted hover:text-ink',
    )

  return (
    <div className="flex flex-col gap-1.5 border-b border-line/70 px-2 py-2">
      <div className="flex items-center gap-1">
        <input
          data-testid="task-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索任务"
          className="h-6 min-w-0 flex-1 rounded-md border border-line bg-panel px-2 text-[11.5px] outline-none placeholder:text-ink-faint focus:border-accent/60"
        />
        <span data-testid="task-count" className="shrink-0 text-[10px] text-ink-faint tnum">
          {count}
        </span>
      </div>
      <ChipGroup label="按状态筛选">
        {STATUS_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={status === item.value}
            onClick={() => setStatus(item.value)}
            className={chip(status === item.value)}
          >
            {item.label}
          </button>
        ))}
      </ChipGroup>
      <ChipGroup label="按时间筛选">
        {TIME_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            data-testid={`task-time-${item.value}`}
            aria-pressed={time === item.value}
            onClick={() => setTime(item.value)}
            className={chip(time === item.value)}
          >
            {item.label}
          </button>
        ))}
      </ChipGroup>
    </div>
  )
}
