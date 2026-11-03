import type { JSX } from 'react'

import { cn } from '@/lib/utils'
import { useUiStore, type TimelineFilter } from '@/state/ui-state'

const OPTIONS: Array<{ value: TimelineFilter; label: string }> = [
  { value: 'key', label: '关键' },
  { value: 'all', label: '全部' },
  { value: 'failed', label: '失败' },
]

export function FilterToggle(): JSX.Element {
  const filter = useUiStore((state) => state.filter)
  const setFilter = useUiStore((state) => state.setFilter)
  return (
    <div
      data-testid="filter-toggle"
      className="flex items-center gap-0.5 rounded-md border border-line bg-panel p-0.5"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={filter === option.value}
          onClick={() => setFilter(option.value)}
          className={cn(
            'rounded-sm px-1.5 py-0.5 text-[10.5px] transition-colors duration-[var(--dur-fast)]',
            filter === option.value ? 'bg-panel-muted text-ink' : 'text-ink-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
