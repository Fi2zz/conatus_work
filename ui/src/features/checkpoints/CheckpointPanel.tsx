import type { JSX } from 'react'

import { cn } from '@/lib/utils'
import { useWorkbench } from '@/state/workbench-store'

export function CheckpointPanel(): JSX.Element {
  const run = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId] : undefined))

  if (!run) return <p className="p-3 text-[12px] text-ink-muted">未选择任务。</p>

  const { turns, keep, currentTurn, gaps } = run.checkpoints

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {gaps.length > 0 ? (
        <p data-testid="checkpoint-gap-banner" className="border-b border-line bg-warning/10 px-3 py-1.5 text-[11px] text-warning">
          检查点存在空洞（轮次 {gaps.join('、')} 缺失），撤销步数按实际存在的轮次计算。
        </p>
      ) : null}

      <div className="border-b border-line px-3 py-1.5 text-[11.5px] text-ink-muted">
        当前轮次 {currentTurn} · 保留最近 {keep} 轮
      </div>

      <ul data-testid="checkpoint-list" className="overflow-auto">
        {[...turns]
          .sort((left, right) => right.turn - left.turn)
          .map((turn) => {
            const pruned = currentTurn - keep >= turn.turn
            return (
              <li
                key={turn.turn}
                data-testid={pruned ? `checkpoint-pruned-${turn.turn}` : `checkpoint-turn-${turn.turn}`}
                aria-disabled={pruned}
                className={cn('px-3 py-1.5 text-[11.5px]', pruned && 'text-ink-muted line-through')}
              >
                <span className="font-semibold">轮次 {turn.turn}</span>
                <span className="ml-2 text-ink-muted">{turn.at}</span>
                <span className="ml-2 text-ink-muted">{turn.eventCount} 个事件</span>
                {pruned ? <span className="ml-2">（已裁剪）</span> : null}
              </li>
            )
          })}
      </ul>

      <p className="mt-auto border-t border-line px-3 py-2 text-[11px] text-ink-muted">
        超出保留范围的轮次无法撤销或重做。
      </p>
    </div>
  )
}
