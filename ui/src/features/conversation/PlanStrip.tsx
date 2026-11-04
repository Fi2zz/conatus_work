import { useState } from 'react'
import type { JSX } from 'react'

import type { PlanItem } from '@/bridge/types'
import { cn } from '@/lib/utils'

const MARK: Record<PlanItem['status'], { icon: string; tone: string; label: string }> = {
  todo: { icon: '○', tone: 'text-ink-faint', label: '待办' },
  doing: { icon: '●', tone: 'text-accent', label: '进行中' },
  done: { icon: '✓', tone: 'text-success', label: '完成' },
  failed: { icon: '✗', tone: 'text-danger', label: '失败' },
}

/** 任务计划条：数据来自 `plan/updated`，默认展开，可折叠成一行进度。 */
export function PlanStrip({ plan }: { plan: PlanItem[] }): JSX.Element {
  const [open, setOpen] = useState(true)
  const done = plan.filter((item) => item.status === 'done').length
  const current = plan.find((item) => item.status === 'doing' || item.status === 'failed')

  if (plan.length === 0) return <></>
  return (
    <div data-testid="plan-strip" className="border-b border-line/70 bg-panel/60 px-4 py-1.5">
      <button
        type="button"
        data-testid="plan-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="label-micro">计划</span>
        <span className="text-[10.5px] text-ink-muted tnum">
          {done}/{plan.length}
        </span>
        {current ? (
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-[11px]',
              current.status === 'failed' ? 'text-danger' : 'text-ink-muted',
            )}
          >
            {current.title}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <span className="shrink-0 text-[10px] text-ink-faint">{open ? '收起' : '展开'}</span>
      </button>
      {open ? (
        <ol data-testid="plan-items" className="mt-1 flex flex-col gap-0.5 pl-1">
          {plan.map((item) => {
            const mark = MARK[item.status]
            return (
              <li
                key={item.id}
                data-testid="plan-item"
                data-status={item.status}
                className="flex items-baseline gap-2 text-[11.5px]"
              >
                <span aria-hidden className={cn('w-3 shrink-0 text-center text-[10px]', mark.tone)}>
                  {mark.icon}
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate',
                    item.status === 'done' && 'text-ink-muted line-through',
                    item.status === 'failed' ? 'text-danger' : 'text-ink',
                  )}
                >
                  {item.title}
                </span>
                <span className={cn('shrink-0 text-[10px]', mark.tone)}>{mark.label}</span>
              </li>
            )
          })}
        </ol>
      ) : null}
    </div>
  )
}
