import type { JSX } from 'react'

import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { useWorkbench } from '@/state/workbench-store'

export function CheckpointPanel(): JSX.Element {
  const run = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId] : undefined))

  if (!run) return <EmptyState title="未选择任务" hint="检查点按轮次记录，撤销与重做都依赖它。" />

  const { turns, keep, currentTurn, gaps } = run.checkpoints

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {gaps.length > 0 ? (
        <p
          data-testid="checkpoint-gap-banner"
          className="border-b border-warning/30 bg-warning/10 px-3 py-1.5 text-[10.5px] leading-relaxed text-warning"
        >
          检查点存在空洞（轮次 {gaps.join('、')} 缺失），撤销步数按实际存在的轮次计算。
        </p>
      ) : null}

      <div className="flex items-center justify-between border-b border-line/70 px-3 py-2">
        <span className="text-[11px] text-ink-muted">
          当前轮次 <span className="font-semibold text-ink tnum">{currentTurn}</span>
        </span>
        <Badge>保留 {keep} 轮</Badge>
      </div>

      {turns.length === 0 ? (
        <EmptyState title="还没有检查点" hint="任务收口时会记一轮，之后才有可撤销的范围。" />
      ) : (
        <ul data-testid="checkpoint-list" className="overflow-auto py-1">
          {[...turns]
            .sort((left, right) => right.turn - left.turn)
            .map((turn) => {
              const pruned = currentTurn - keep >= turn.turn
              return (
                <li
                  key={turn.turn}
                  data-testid={pruned ? `checkpoint-pruned-${turn.turn}` : `checkpoint-turn-${turn.turn}`}
                  aria-disabled={pruned}
                  className={cn(
                    'relative flex items-baseline gap-2 px-3 py-1.5 text-[11.5px]',
                    pruned ? 'text-ink-faint' : 'text-ink',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-3 left-1.5 h-1.5 w-1.5 rounded-full',
                      pruned ? 'bg-line-strong' : 'bg-accent',
                    )}
                  />
                  <span className="w-14 shrink-0 pl-2 font-semibold tnum">轮次 {turn.turn}</span>
                  <span className="min-w-0 flex-1 truncate text-[10.5px] text-ink-muted">{turn.at}</span>
                  <span className="shrink-0 text-[10px] text-ink-faint tnum">{turn.eventCount} 事件</span>
                  {pruned ? <span className="shrink-0 text-[10px]">已裁剪</span> : null}
                </li>
              )
            })}
        </ul>
      )}

      <p className="mt-auto border-t border-line/70 px-3 py-2 text-[10.5px] text-ink-muted">
        超出保留范围的轮次无法撤销或重做。
      </p>
    </div>
  )
}
