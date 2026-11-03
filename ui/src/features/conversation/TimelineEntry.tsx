import type { JSX } from 'react'

import type { TimelineEntry } from '@/bridge/types'
import { Badge } from '@/components/ui/badge'
import { renderMarkdown } from '@/features/artifacts/markdown'
import { cn } from '@/lib/utils'
import { formatDuration, formatOffset } from '@/lib/time'

interface EntryRowProps {
  entry: TimelineEntry
  expanded: boolean
  onToggle: (key: string) => void
}

function ToolRow({ entry, expanded, onToggle }: EntryRowProps): JSX.Element {
  if (entry.kind !== 'tool') return <></>
  const grouped = (entry.count ?? 1) > 1
  const label = grouped ? `${entry.name} ×${entry.count}` : entry.name
  const failed = entry.ok === false
  return (
    <div className="group relative">
      <button
        type="button"
        data-testid={grouped ? 'tool-group' : 'timeline-entry-tool'}
        onClick={() => onToggle(entry.id)}
        aria-expanded={expanded}
        className={cn(
          'flex w-full items-baseline gap-2 rounded-md py-1 pr-2 pl-3 text-left transition-colors duration-[var(--dur-fast)] hover:bg-panel-muted',
          failed && 'bg-danger/5',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute top-2 bottom-2 left-1 w-px',
            failed ? 'bg-danger/60' : 'bg-line',
          )}
        />
        <span className="w-9 shrink-0 text-[10px] text-ink-faint tnum">{formatOffset(entry.at)}</span>
        <span
          className={cn(
            'shrink-0 font-mono text-[11.5px] font-semibold',
            failed ? 'text-danger' : 'text-ink',
          )}
        >
          {label}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-ink-muted">
          {expanded ? entry.args : (entry.summary ?? entry.args)}
        </span>
        <span className="shrink-0 text-[10px] text-ink-faint tnum">
          {formatDuration(entry.durationMs)}
        </span>
      </button>
      {expanded ? (
        <pre className="mx-3 mb-2 overflow-auto rounded-md border border-line bg-panel-muted px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-ink-muted">
          {entry.args}
        </pre>
      ) : null}
    </div>
  )
}

export function EntryRow({ entry, expanded, onToggle }: EntryRowProps): JSX.Element {
  if (entry.kind === 'user') {
    const long = entry.text.length > 240
    return (
      <div data-testid="timeline-entry-user" className="rise flex gap-3 py-2">
        <span className="w-9 shrink-0 pt-0.5 text-[10px] text-ink-faint tnum">{formatOffset(entry.at)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between pb-1">
            <span className="label-micro">你</span>
            {long ? (
              <button
                type="button"
                onClick={() => onToggle(entry.id)}
                className="text-[10.5px] text-ink-muted hover:text-ink"
              >
                {expanded ? '收起' : '展开全文'}
              </button>
            ) : null}
          </div>
          <p
            className={cn(
              'rounded-md border border-line bg-panel-raised px-2.5 py-1.5 text-[12.5px] leading-relaxed whitespace-pre-wrap',
              long && !expanded && 'line-clamp-5',
            )}
          >
            {entry.text}
          </p>
        </div>
      </div>
    )
  }

  if (entry.kind === 'assistant') {
    return (
      <div data-testid="timeline-entry-assistant" className="rise flex gap-3 py-2">
        <span className="w-9 shrink-0 pt-0.5 text-[10px] text-ink-faint tnum">{formatOffset(entry.at)}</span>
        <div className="min-w-0 flex-1">
          {entry.reasoning ? (
            <button
              type="button"
              data-testid="reasoning-toggle"
              onClick={() => onToggle(entry.id)}
              className="mb-1.5 inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              <span aria-hidden>{expanded ? '▾' : '▸'}</span>
              {expanded ? '收起思考' : '思考'}
            </button>
          ) : null}
          {expanded && entry.reasoning ? (
            <p className="mb-1.5 border-l-2 border-line py-0.5 pl-2 text-[11.5px] leading-relaxed text-ink-muted">
              {entry.reasoning}
            </p>
          ) : null}
          {entry.streaming ? (
            <p data-testid="assistant-streaming" className="prose-wb whitespace-pre-wrap">
              {entry.text}
              <span aria-hidden className="stream-caret">
                ▍
              </span>
            </p>
          ) : (
            <div
              className="prose-wb"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.text) }}
            />
          )}
        </div>
      </div>
    )
  }

  if (entry.kind === 'tool') return <ToolRow entry={entry} expanded={expanded} onToggle={onToggle} />

  const label =
    entry.kind === 'approval'
      ? `审批 · ${entry.name} · ${entry.decision === 'deny' ? '已拒绝' : entry.decision === 'allow' ? '已允许' : '待决定'}`
      : entry.kind === 'undo'
        ? `撤销 ${entry.steps} 轮 · ${entry.ok ? '成功' : `失败（${entry.failures.length} 个文件）`}`
        : entry.kind === 'redo'
          ? `重做 ${entry.steps} 轮 · ${entry.ok ? '成功' : '失败'}`
          : `状态 · ${entry.status}${entry.text ? ` · ${entry.text}` : ''}`

  const tone =
    entry.kind === 'status' && (entry.status === 'failed' || entry.status === 'aborted')
      ? 'danger'
      : 'neutral'

  return (
    <div
      data-testid={`timeline-entry-${entry.kind}`}
      className="flex items-baseline gap-2 py-1 pl-3 text-[11px]"
    >
      <span className="w-9 shrink-0 text-[10px] text-ink-faint tnum">{formatOffset(entry.at)}</span>
      <Badge tone={tone}>{label}</Badge>
    </div>
  )
}
