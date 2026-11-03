import type { JSX } from 'react'

import { cn } from '@/lib/utils'
import { useUiStore, type TimelineFilter } from '@/state/ui-state'

const OPTIONS: Array<{ value: TimelineFilter; label: string }> = [
  { value: 'key', label: '关键' },
  { value: 'all', label: '全部' },
]

export function FilterToggle(): JSX.Element {
  const filter = useUiStore((state) => state.filter)
  const setFilter = useUiStore((state) => state.setFilter)
  return (
    <div data-testid="filter-toggle" className="flex items-center gap-1">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={filter === option.value}
          onClick={() => setFilter(option.value)}
          className={cn(
            'rounded border px-2 py-0.5 text-[11px]',
            filter === option.value ? 'border-line bg-panel text-ink' : 'border-transparent text-ink-muted',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
