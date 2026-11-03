import type { JSX } from 'react'

import { EmptyState } from '@/components/ui/empty-state'
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
      <div className="flex items-center justify-between border-b border-line/70 px-3 py-1.5">
        <span className="label-micro">执行过程</span>
        <div className="flex items-center gap-2">
          {import.meta.env.DEV && pending > 0 ? (
            <span data-testid="unknown-events-badge" className="text-[10px] text-warning tnum">
              未知事件 {pending}
            </span>
          ) : null}
          <FilterToggle />
        </div>
      </div>
      <div data-testid="timeline-list" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {entries.length === 0 ? (
          <EmptyState
            title={run ? '还没有过程记录' : '未选择任务'}
            hint={run ? '任务开始执行后，消息与工具调用会按时间顺序出现在这里。' : '从左侧选一条运行，看它的完整过程。'}
          />
        ) : (
          <div className="flex flex-col">
            {entries.map((entry) => (
              <EntryRow
                key={`${entry.kind}-${entry.id}`}
                entry={entry}
                expanded={expandedKeys.has(entry.id)}
                onToggle={toggleExpanded}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
