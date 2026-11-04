import { useEffect } from 'react'
import type { JSX } from 'react'

import { Tabs } from '@/components/ui/tabs'
import { ArtifactPanel } from '@/features/artifacts/ArtifactPanel'
import { ChangePanel } from '@/features/changes/ChangePanel'
import { CheckpointPanel } from '@/features/checkpoints/CheckpointPanel'
import { WorkspacePanel } from '@/features/workspace/WorkspacePanel'
import { cn } from '@/lib/utils'
import { useUiStore, type RightTab } from '@/state/ui-state'
import { useWorkbench } from '@/state/workbench-store'

const TABS: Array<{ value: RightTab; label: string }> = [
  { value: 'artifacts', label: '产物' },
  { value: 'files', label: '文件' },
  { value: 'changes', label: '变更' },
  { value: 'checkpoints', label: '检查点' },
]

export function RightPane(): JSX.Element {
  const tab = useUiStore((state) => state.rightTab)
  const setTab = useUiStore((state) => state.setRightTab)
  const expanded = useUiStore((state) => state.rightExpanded)
  const setExpanded = useUiStore((state) => state.setRightExpanded)
  const run = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId] : undefined))

  useEffect(() => {
    if (!expanded) return
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expanded, setExpanded])

  const counts: Record<RightTab, number | undefined> = {
    artifacts: run?.artifacts.length,
    files: undefined,
    changes: run?.changes?.files.length,
    checkpoints: run?.checkpoints.turns.length,
  }

  return (
    <aside
      data-testid="right-pane"
      data-expanded={expanded}
      className={cn(
        'flex min-h-0 flex-col bg-panel',
        expanded && 'fixed inset-0 z-40 shadow-panel',
      )}
    >
      <div className="flex items-center gap-1 border-b border-line/70">
        <div className="min-w-0 flex-1">
          <Tabs
            items={TABS.map((item) => ({ ...item, count: counts[item.value] }))}
            value={tab}
            onChange={setTab}
          />
        </div>
        <button
          type="button"
          data-testid="right-expand"
          aria-label={expanded ? '退出全屏' : '全屏查看结果'}
          onClick={() => setExpanded(!expanded)}
          className="mr-1 shrink-0 rounded-sm px-1 text-[10.5px] text-ink-muted hover:bg-panel-muted hover:text-ink"
        >
          {expanded ? '退出全屏' : '全屏'}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {tab === 'artifacts' ? <ArtifactPanel /> : null}
        {tab === 'files' ? <WorkspacePanel /> : null}
        {tab === 'changes' ? <ChangePanel /> : null}
        {tab === 'checkpoints' ? <CheckpointPanel /> : null}
      </div>
    </aside>
  )
}
