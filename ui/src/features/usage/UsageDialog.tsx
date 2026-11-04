import { useMemo } from 'react'
import type { JSX } from 'react'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { runMetrics } from '@/state/selectors'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench } from '@/state/workbench-store'

function tokens(value: number): string {
  return value.toLocaleString('zh-CN')
}

export function UsageDialog(): JSX.Element {
  const open = useUiStore((state) => state.usageOpen)
  const setOpen = useUiStore((state) => state.setUsageOpen)
  const order = useWorkbench((state) => state.order)
  const runs = useWorkbench((state) => state.runs)

  const summaries = useMemo(
    () => order.map((id) => runs[id]).filter((run): run is NonNullable<typeof run> => Boolean(run)),
    [order, runs],
  )
  const total = runMetrics(summaries)
  const chains = useMemo(() => {
    const groups = new Map<string, { tasks: number; input: number; output: number; cost: number }>()
    for (const run of summaries) {
      const current = groups.get(run.chain) ?? { tasks: 0, input: 0, output: 0, cost: 0 }
      groups.set(run.chain, {
        tasks: current.tasks + 1,
        input: current.input + run.usage.inputTokens,
        output: current.output + run.usage.outputTokens,
        cost: current.cost + run.usage.costUsd,
      })
    }
    return [...groups.entries()].sort((left, right) => right[1].cost - left[1].cost)
  }, [summaries])

  if (!open) return <></>
  return (
    <Dialog open onOpenChange={setOpen}>
      <DialogContent labelledBy="usage-title" className="w-[520px]">
        <DialogTitle id="usage-title">用量与成本</DialogTitle>
        <div data-testid="usage-dialog" className="flex flex-col gap-3 text-[12px]">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['任务', `${total.tasks}`],
              ['输入 token', tokens(total.inputTokens)],
              ['输出 token', tokens(total.outputTokens)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-line bg-panel-muted/50 px-2.5 py-2">
                <p className="label-micro">{label}</p>
                <p className="mt-1 text-[15px] font-semibold tnum">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex items-baseline justify-between rounded-md border border-accent/30 bg-accent/5 px-3 py-2">
            <span className="text-[11.5px] text-ink-muted">累计成本（按当前单价估算）</span>
            <span data-testid="usage-cost" className="text-[16px] font-semibold text-accent tnum">
              ${total.costUsd.toFixed(4)}
            </span>
          </div>
          <div>
            <p className="label-micro mb-1">按任务链</p>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-line text-left text-ink-faint">
                  <th className="py-1 font-medium">链</th>
                  <th className="py-1 text-right font-medium">任务</th>
                  <th className="py-1 text-right font-medium">输入</th>
                  <th className="py-1 text-right font-medium">输出</th>
                  <th className="py-1 text-right font-medium">成本</th>
                </tr>
              </thead>
              <tbody data-testid="usage-chains">
                {chains.map(([chain, value]) => (
                  <tr key={chain} className="border-b border-line/50">
                    <td className="py-1">{chain}</td>
                    <td className="py-1 text-right tnum">{value.tasks}</td>
                    <td className="py-1 text-right tnum">{tokens(value.input)}</td>
                    <td className="py-1 text-right tnum">{tokens(value.output)}</td>
                    <td className="py-1 text-right tnum">${value.cost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10.5px] text-ink-faint">
            原型统计：只汇总当前任务列表，未接账单、积分或缓存折扣。
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
