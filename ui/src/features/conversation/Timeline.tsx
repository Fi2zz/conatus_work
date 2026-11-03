import type { JSX } from 'react'

import { filterTimeline, groupConsecutiveTools } from '@/state/selectors'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench } from '@/state/workbench-store'
import { EntryRow } from './TimelineEntry'
import { FilterToggle } from './FilterToggle'

interface TimelineProps {
  unknownEvents?: number
}

export function Timeline({ unknownEvents }: TimelineProps = {}): JSX.Element {
  const run = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId] : undefined))
  const counter = useWorkbench((state) => state.unknownEvents)
  const filter = useUiStore((state) => state.filter)
  const expandedKeys = useUiStore((state) => state.expandedKeys)
  const toggleExpanded = useUiStore((state) => state.toggleExpanded)
  const pending = unknownEvents ?? counter

  const entries = run ? filterTimeline(groupConsecutiveTools(run.timeline, expandedKeys), filter) : []

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="text-[11px] text-ink-muted">执行过程</span>
        <div className="flex items-center gap-2">
          {import.meta.env.DEV && pending > 0 ? (
            <span data-testid="unknown-events-badge" className="rounded bg-warning/15 px-1.5 text-[10.5px] text-warning">
              未知事件 {pending}
            </span>
          ) : null}
          <FilterToggle />
        </div>
      </div>
      <div data-testid="timeline-list" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
        {entries.length === 0 ? (
          <p className="p-2 text-[12px] text-ink-muted">还没有事件。</p>
        ) : (
          entries.map((entry) => (
            <EntryRow
              key={`${entry.kind}-${entry.id}`}
              entry={entry}
              expanded={expandedKeys.has(entry.id)}
              onToggle={toggleExpanded}
            />
          ))
        )}
      </div>
    </div>
  )
}
