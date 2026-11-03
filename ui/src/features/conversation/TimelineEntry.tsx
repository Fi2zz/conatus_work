import type { JSX } from 'react'

import type { TimelineEntry } from '@/bridge/types'
import { cn } from '@/lib/utils'

interface EntryRowProps {
  entry: TimelineEntry
  expanded: boolean
  onToggle: (key: string) => void
}

function ToolRow({ entry, expanded, onToggle }: EntryRowProps): JSX.Element {
  if (entry.kind !== 'tool') return <></>
  const grouped = (entry.count ?? 1) > 1
  const label = grouped ? `${entry.name} ×${entry.count}` : entry.name
  return (
    <button
      type="button"
      data-testid={grouped ? 'tool-group' : 'timeline-entry-tool'}
      onClick={() => onToggle(entry.id)}
      className={cn(
        'flex w-full items-center gap-2 rounded border-l-2 border-transparent px-2 py-1 text-left font-mono text-[11.5px] hover:bg-panel-muted',
        entry.ok === false && 'border-danger text-danger',
      )}
    >
      <span className="w-4 shrink-0 text-ink-muted">{entry.ok === false ? '✗' : '›'}</span>
      <span className="shrink-0 font-semibold">{label}</span>
      <span className="truncate text-ink-muted">
        {expanded ? entry.args : (entry.summary ?? entry.args)}
      </span>
      <span className="ml-auto shrink-0 text-[10.5px] text-ink-muted">
        {entry.durationMs !== undefined ? `${entry.durationMs} ms` : ''}
      </span>
    </button>
  )
}

export function EntryRow({ entry, expanded, onToggle }: EntryRowProps): JSX.Element {
  if (entry.kind === 'user') {
    return (
      <div data-testid="timeline-entry-user" className="rounded-md bg-panel-muted px-3 py-2 text-[12.5px]">
        <span className="mr-1.5 text-[10.5px] uppercase tracking-wide text-ink-muted">你</span>
        {entry.text}
      </div>
    )
  }

  if (entry.kind === 'assistant') {
    return (
      <div data-testid="timeline-entry-assistant" className="px-2 py-1.5 text-[12.5px]">
        {entry.reasoning ? (
          <button
            type="button"
            data-testid="reasoning-toggle"
            onClick={() => onToggle(entry.id)}
            className="mb-1 rounded border border-line px-1.5 py-0.5 text-[10.5px] text-ink-muted"
          >
            {expanded ? '收起思考' : '思考'}
          </button>
        ) : null}
        {expanded && entry.reasoning ? (
          <p className="mb-1 border-l-2 border-line pl-2 text-[11.5px] text-ink-muted">{entry.reasoning}</p>
        ) : null}
        <p className="whitespace-pre-wrap">{entry.text}</p>
      </div>
    )
  }

  if (entry.kind === 'tool') return <ToolRow entry={entry} expanded={expanded} onToggle={onToggle} />

  if (entry.kind === 'approval') {
    return (
      <div data-testid="timeline-entry-approval" className="px-2 py-1 text-[11.5px] text-ink-muted">
        审批 · {entry.name} · {entry.decision === 'deny' ? '已拒绝' : entry.decision === 'allow' ? '已允许' : '待决定'}
      </div>
    )
  }

  if (entry.kind === 'undo') {
    return (
      <div data-testid="timeline-entry-undo" className="px-2 py-1 text-[11.5px] text-ink-muted">
        撤销 {entry.steps} 轮 · {entry.ok ? '成功' : `失败（${entry.failures.length} 个文件）`}
      </div>
    )
  }

  return (
    <div data-testid="timeline-entry-status" className="px-2 py-1 text-[11.5px] text-ink-muted">
      状态 · {entry.status}
    </div>
  )
}
