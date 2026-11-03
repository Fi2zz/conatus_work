import type { JSX } from 'react'

import { diffLines } from '@/state/selectors'
import { cn } from '@/lib/utils'

interface DiffViewProps {
  from: string
  to: string
}

export function DiffView({ from, to }: DiffViewProps): JSX.Element {
  const lines = diffLines(`- ${from}\n+ ${to}`)
  return (
    <div data-testid="diff-view" className="overflow-auto rounded border border-line font-mono text-[11px]">
      {lines.map((line) => (
        <div
          key={`${line.n}-${line.kind}`}
          data-testid={`diff-line-${line.kind}`}
          className={cn(
            'flex gap-2 px-2',
            line.kind === 'add' && 'bg-success/10 text-success',
            line.kind === 'del' && 'bg-danger/10 text-danger',
          )}
        >
          <span className="w-6 shrink-0 text-right text-ink-muted">{line.n}</span>
          <span className="shrink-0">{line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' '}</span>
          <span className="truncate">{line.text}</span>
        </div>
      ))}
    </div>
  )
}
