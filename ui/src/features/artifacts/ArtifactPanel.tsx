import type { JSX } from 'react'

import { cn } from '@/lib/utils'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench } from '@/state/workbench-store'
import { ArtifactPreview } from './ArtifactPreview'

export function ArtifactPanel(): JSX.Element {
  const run = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId] : undefined))
  const selected = useUiStore((state) => state.selectedArtifact)
  const setSelected = useUiStore((state) => state.setSelectedArtifact)

  const artifacts = run?.artifacts ?? []
  const active = artifacts.find((artifact) => artifact.path === selected) ?? artifacts[0]

  if (!run || artifacts.length === 0) {
    return <p className="p-3 text-[12px] text-ink-muted">这次运行没有产物。</p>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul data-testid="artifact-list" className="border-b border-line">
        {artifacts.map((artifact) => (
          <li key={artifact.path}>
            <button
              type="button"
              onClick={() => setSelected(artifact.path)}
              className={cn(
                'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left font-mono text-[11.5px] hover:bg-panel-muted',
                artifact.path === active.path && 'bg-panel-muted',
              )}
            >
              <span className="truncate">
                <span className={artifact.check.passed ? 'text-success' : 'text-danger'}>
                  {artifact.check.passed ? '✓' : '✗'}
                </span>{' '}
                {artifact.path}
              </span>
              <span className="shrink-0 text-[10.5px] text-ink-muted">{formatBytes(artifact.bytes)}</span>
            </button>
          </li>
        ))}
      </ul>
      {active ? <ArtifactPreview runId={run.id} artifact={active} /> : null}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}
