import type { JSX, ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  hint?: ReactNode
  action?: ReactNode
  compact?: boolean
}

export function EmptyState({ title, hint, action, compact = false }: EmptyStateProps): JSX.Element {
  return (
    <div
      className={
        compact
          ? 'flex flex-col items-start gap-1 px-3 py-4'
          : 'flex min-h-[220px] flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center'
      }
    >
      <div className="flex items-center gap-2">
        <span className="h-px w-5 bg-line-strong" aria-hidden />
        <span className="text-[12.5px] font-medium text-ink">{title}</span>
      </div>
      {hint ? <p className="max-w-[36ch] text-[11.5px] leading-relaxed text-ink-muted">{hint}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
