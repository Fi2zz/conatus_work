import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import { getTransport, hasTransport } from '@/bridge/transport-store'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench } from '@/state/workbench-store'
import { compareRuns } from '@/lib/compare'
import { cn } from '@/lib/utils'
import type { RunView } from '@/bridge/types'

export function CompareDialog(): JSX.Element {
  const open = useUiStore((state) => state.compareOpen)
  const setOpen = useUiStore((state) => state.setCompareOpen)
  const order = useWorkbench((state) => state.order)
  const runs = useWorkbench((state) => state.runs)
  const activeRunId = useWorkbench((state) => state.activeRunId)
  const [leftId, setLeftId] = useState<string>('')
  const [rightId, setRightId] = useState<string>('')
  const [views, setViews] = useState<[RunView | null, RunView | null]>([null, null])
  const [error, setError] = useState<string | null>(null)
  const [contentPath, setContentPath] = useState<string | null>(null)
  const [contents, setContents] = useState<[string, string] | null>(null)

  useEffect(() => {
    if (!open) return
    setLeftId(activeRunId ?? order[0] ?? '')
    setRightId(order.find((id) => id !== (activeRunId ?? order[0])) ?? order[1] ?? '')
  }, [open, activeRunId, order])

  useEffect(() => {
    if (!open || !leftId || !rightId || !hasTransport()) return
    setError(null)
    void Promise.all([getTransport().openTask(leftId), getTransport().openTask(rightId)])
      .then(([left, right]) => {
        if (!left.ok || !right.ok) {
          setError(!left.ok ? left.error.message : !right.ok ? right.error.message : null)
          return
        }
        setViews([left.value, right.value])
      })
      .catch((cause: unknown) => setError(String(cause)))
  }, [open, leftId, rightId])

  const both = views[0] && views[1]
    ? views[0].artifacts
        .map((artifact) => artifact.path)
        .filter((path) => views[1]!.artifacts.some((artifact) => artifact.path === path))
    : []
  const selectedPath = contentPath && both.includes(contentPath) ? contentPath : (both[0] ?? null)

  useEffect(() => {
    if (!open || !selectedPath || !leftId || !rightId || !hasTransport()) return
    setContents(null)
    void Promise.all([
      getTransport().readArtifact(leftId, selectedPath),
      getTransport().readArtifact(rightId, selectedPath),
    ])
      .then(([left, right]) => {
        if (left.ok && right.ok) setContents([left.value.content, right.value.content])
      })
      .catch(() => undefined)
  }, [open, selectedPath, leftId, rightId])

  if (!open) return <></>
  const [left, right] = views
  const result = left && right ? compareRuns(left, right) : null

  function picker(value: string, onChange: (id: string) => void, testId: string): JSX.Element {
    return (
      <select
        data-testid={testId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 w-full rounded-md border border-line bg-panel px-2 text-[12px]"
      >
        {order.map((id) => (
          <option key={id} value={id}>
            {runs[id]?.title ?? id}
          </option>
        ))}
      </select>
    )
  }

  return (
    <Dialog open onOpenChange={setOpen}>
      <DialogContent labelledBy="compare-title" className="w-[680px]">
        <DialogTitle id="compare-title">运行对比</DialogTitle>
        <div data-testid="compare-dialog" className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            {picker(leftId, setLeftId, 'compare-left')}
            {picker(rightId, setRightId, 'compare-right')}
          </div>
          {error ? <p className="text-[11.5px] text-danger">{error}</p> : null}
          {result ? (
            <>
              <table className="w-full border-collapse text-[11.5px]">
                <thead>
                  <tr className="border-b border-line text-left text-[10.5px] text-ink-muted">
                    <th className="py-1 font-medium">指标</th>
                    <th className="py-1 font-medium">基准</th>
                    <th className="py-1 font-medium">对比</th>
                  </tr>
                </thead>
                <tbody data-testid="compare-metrics">
                  {result.metrics.map((row) => (
                    <tr key={row.label} className="border-b border-line/60">
                      <td className="py-1 text-ink-muted">{row.label}</td>
                      <td className="py-1 tnum">{row.left}</td>
                      <td
                        className={cn(
                          'py-1 tnum',
                          row.delta === 'better' && 'text-success',
                          row.delta === 'worse' && 'text-danger',
                        )}
                      >
                        {row.right}
                        {row.delta === 'better' ? ' ↑' : row.delta === 'worse' ? ' ↓' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                {(
                  [
                    ['仅基准有', result.onlyLeft],
                    ['两者都有', result.both],
                    ['仅对比有', result.onlyRight],
                  ] as Array<[string, string[]]>
                ).map(([label, paths]) => (
                  <div key={label} className="rounded-md border border-line p-2">
                    <div className="label-micro pb-1">{label}</div>
                    {paths.length === 0 ? (
                      <p className="text-ink-faint">—</p>
                    ) : (
                      <ul className="flex flex-col gap-0.5 font-mono text-[10px]">
                        {paths.map((path) => (
                          <li key={path} className="truncate">
                            {path}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>

              {both.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="label-micro">产物正文</span>
                    <select
                      data-testid="compare-artifact-select"
                      value={selectedPath ?? ''}
                      onChange={(event) => setContentPath(event.target.value)}
                      className="h-6 flex-1 rounded-md border border-line bg-panel px-1.5 font-mono text-[10.5px]"
                    >
                      {both.map((path) => (
                        <option key={path} value={path}>
                          {path}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[contents?.[0], contents?.[1]].map((text, index) => (
                      <pre
                        key={index}
                        data-testid={`compare-content-${index}`}
                        className="max-h-40 overflow-auto rounded-md border border-line bg-panel-muted px-2 py-1.5 font-mono text-[10px] leading-relaxed"
                      >
                        {text ?? '加载中…'}
                      </pre>
                    ))}
                  </div>
                </div>
              ) : null}
              <div data-testid="compare-changes" className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
                {result.changes.map((row) => (
                  <span key={row.label}>
                    {row.label}{' '}
                    <span className="text-ink tnum">
                      {row.left} → {row.right}
                    </span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[11.5px] text-ink-muted">选两条运行后显示差异。</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
