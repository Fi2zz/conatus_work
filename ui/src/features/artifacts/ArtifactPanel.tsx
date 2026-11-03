import type { JSX } from 'react'

import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench } from '@/state/workbench-store'
import { ArtifactPreview } from './ArtifactPreview'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export function ArtifactPanel(): JSX.Element {
  const run = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId] : undefined))
  const selected = useUiStore((state) => state.selectedArtifact)
  const setSelected = useUiStore((state) => state.setSelectedArtifact)

  const artifacts = run?.artifacts ?? []
  const active = artifacts.find((artifact) => artifact.path === selected) ?? artifacts[0]

  if (!run) return <EmptyState title="未选择任务" hint="选一条运行后，这里会列出它产出的文件。" />
  if (artifacts.length === 0) {
    return (
      <EmptyState
        title="这次运行没有产物"
        hint="产物是任务期望写出的文件（报告、清单、图表等），运行成功后出现在这里。"
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul data-testid="artifact-list" className="border-b border-line/70 py-1">
        {artifacts.map((artifact) => {
          const activeRow = artifact.path === active.path
          return (
            <li key={artifact.path}>
              <button
                type="button"
                onClick={() => setSelected(artifact.path)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-[var(--dur-fast)] hover:bg-panel-muted',
                  activeRow && 'bg-panel-muted',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    artifact.check.passed ? 'bg-success' : 'bg-danger',
                  )}
                />
                <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]">{artifact.path}</span>
                <span className="shrink-0 text-[10.5px] text-ink-faint tnum">{formatBytes(artifact.bytes)}</span>
                <span className="w-4 shrink-0 text-center text-[10px]">
                  {artifact.check.passed ? (
                    <span className="text-success">✓</span>
                  ) : (
                    <span className="text-danger">✗</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {active ? <ArtifactPreview runId={run.id} artifact={active} /> : null}
    </div>
  )
}
