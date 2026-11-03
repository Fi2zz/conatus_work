import type { JSX } from 'react'

import { Tabs } from '@/components/ui/tabs'
import { ArtifactPanel } from '@/features/artifacts/ArtifactPanel'
import { ChangePanel } from '@/features/changes/ChangePanel'
import { CheckpointPanel } from '@/features/checkpoints/CheckpointPanel'
import { useUiStore, type RightTab } from '@/state/ui-state'
import { useWorkbench } from '@/state/workbench-store'

const TABS: Array<{ value: RightTab; label: string }> = [
  { value: 'artifacts', label: '产物' },
  { value: 'changes', label: '变更' },
  { value: 'checkpoints', label: '检查点' },
]

export function RightPane(): JSX.Element {
  const tab = useUiStore((state) => state.rightTab)
  const setTab = useUiStore((state) => state.setRightTab)
  const run = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId] : undefined))

  const counts: Record<RightTab, number | undefined> = {
    artifacts: run?.artifacts.length,
    changes: run?.changes?.files.length,
    checkpoints: run?.checkpoints.turns.length,
  }

  return (
    <aside data-testid="right-pane" className="flex min-h-0 flex-col bg-panel">
      <div className="border-b border-line/70">
        <Tabs
          items={TABS.map((item) => ({ ...item, count: counts[item.value] }))}
          value={tab}
          onChange={setTab}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {tab === 'artifacts' ? <ArtifactPanel /> : null}
        {tab === 'changes' ? <ChangePanel /> : null}
        {tab === 'checkpoints' ? <CheckpointPanel /> : null}
      </div>
    </aside>
  )
}
