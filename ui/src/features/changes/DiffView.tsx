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
    <div data-testid="diff-view" className="overflow-auto rounded-md border border-line">
      <div className="flex items-center gap-2 border-b border-line bg-panel-muted px-2 py-1 font-mono text-[10px] text-ink-muted">
        <span>@@ 路径变更 @@</span>
      </div>
      <div className="font-mono text-[11px] leading-relaxed">
        {lines.map((line) => (
          <div
            key={`${line.n}-${line.kind}`}
            data-testid={`diff-line-${line.kind}`}
            className={cn(
              'flex gap-2 px-2',
              line.kind === 'add' && 'bg-success/8 text-success',
              line.kind === 'del' && 'bg-danger/8 text-danger',
            )}
          >
            <span className="w-6 shrink-0 border-r border-line/60 pr-1 text-right text-ink-faint tnum">
              {line.n}
            </span>
            <span className="w-2 shrink-0 text-center">
              {line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' '}
            </span>
            <span className="min-w-0 flex-1 truncate">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
