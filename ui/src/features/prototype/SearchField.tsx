import type { JSX } from 'react'

import { cn } from '@/lib/utils'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  testId?: string
}

export function SearchField({ value, onChange, placeholder, testId }: SearchFieldProps): JSX.Element {
  return (
    <input
      data-testid={testId}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-7 w-56 rounded-md border border-line bg-panel px-2 text-[11.5px] outline-none placeholder:text-ink-faint focus:border-accent/60"
    />
  )
}

interface Chip {
  value: string
  label: string
}

interface ChipBarProps {
  options: Chip[]
  value: string
  onChange: (value: string) => void
  testId?: string
}

export function ChipBar({ options, value, onChange, testId }: ChipBarProps): JSX.Element {
  return (
    <div data-testid={testId} className="flex flex-wrap items-center gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-full border px-2 py-0.5 text-[10.5px] transition-colors',
            value === option.value
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-line text-ink-muted hover:bg-panel-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
