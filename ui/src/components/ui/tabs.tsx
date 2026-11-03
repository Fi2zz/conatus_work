import type { JSX } from 'react'

import { cn } from '@/lib/utils'

interface TabItem<T extends string> {
  value: T
  label: string
  count?: number
}

interface TabsProps<T extends string> {
  items: Array<TabItem<T>>
  value: T
  onChange: (value: T) => void
  testId?: string
}

export function Tabs<T extends string>({ items, value, onChange, testId }: TabsProps<T>): JSX.Element {
  return (
    <div role="group" data-testid={testId} className="flex items-stretch gap-0.5 px-2">
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            aria-label={item.label}
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative px-2 py-2 text-[12px] transition-colors duration-[var(--dur-fast)]',
              active ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className="ml-1 text-[10.5px] text-ink-faint tnum">{item.count}</span>
            ) : null}
            <span
              aria-hidden
              className={cn(
                'absolute inset-x-1 -bottom-px h-[2px] rounded-full transition-opacity duration-[var(--dur-fast)]',
                active ? 'bg-accent opacity-100' : 'bg-transparent opacity-0',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
