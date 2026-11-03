import type { JSX } from 'react'

import { useWorkbench } from '@/state/workbench-store'

export function SettingsPage(): JSX.Element {
  const run = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId] : undefined))
  const keep = run?.checkpoints.keep ?? 5

  return (
    <div data-testid="settings-page" className="flex flex-col gap-3 p-3 text-[12px]">
      <div>
        <div className="text-[10.5px] uppercase tracking-wide text-ink-muted">模型</div>
        <div data-testid="settings-model" className="font-mono">
          {run?.model ?? '—'}
        </div>
      </div>
      <div>
        <div className="text-[10.5px] uppercase tracking-wide text-ink-muted">工作区</div>
        <div data-testid="settings-workspace" className="font-mono text-ink-muted">
          {run ? `${run.taskId} 的工作区` : '—'}
        </div>
      </div>
      <div>
        <div className="text-[10.5px] uppercase tracking-wide text-ink-muted">保留轮次</div>
        <div data-testid="settings-keep" className="font-mono">
          {keep}
        </div>
      </div>
      <p className="text-[10.5px] text-ink-muted">回放模式下这些值只读，接线真实运行时才可编辑。</p>
    </div>
  )
}
