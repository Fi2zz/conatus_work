import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import { getTransport, hasTransport } from '@/bridge/transport-store'
import type { TaskCard } from '@/bridge/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench, useWorkbenchStore } from '@/state/workbench-store'
import { readDefaultWorkspace } from '@/lib/preferences'
import { compareRuns } from '@/lib/compare'
import { cn } from '@/lib/utils'
import type { RunView } from '@/bridge/types'

export function NewTaskDialog(): JSX.Element {
  const open = useUiStore((state) => state.newTaskOpen)
  const setOpen = useUiStore((state) => state.setNewTaskOpen)
  const adoptRun = useWorkbenchStore((store) => store.adoptRun)
  const [cards, setCards] = useState<TaskCard[]>([])
  const [error, setError] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<string | null>(() => readDefaultWorkspace())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !hasTransport()) return
    setWorkspace(readDefaultWorkspace())
    void getTransport()
      .listCards()
      .then((result) => {
        if (result.ok) setCards(result.value)
        else setError(result.error.message)
      })
      .catch((cause: unknown) => setError(String(cause)))
  }, [open])

  async function pick(card: TaskCard): Promise<void> {
    setBusy(true)
    setError(null)
    const started = await getTransport().startTask(card.id, workspace ?? undefined)
    if (!started.ok) {
      setError(started.error.message)
      setBusy(false)
      return
    }
    setOpen(false)
    setBusy(false)
    const view = await getTransport().openTask(started.value.runId)
    if (view.ok) adoptRun(view.value)
  }

  if (!open) return <></>
  return (
    <Dialog open onOpenChange={setOpen}>
      <DialogContent labelledBy="new-task-title" className="w-[520px]">
        <DialogTitle id="new-task-title">新任务</DialogTitle>
        <div data-testid="new-task-dialog">
          {error ? <p className="mb-2 rounded-sm bg-danger/10 px-2 py-1 text-[11.5px] text-danger">{error}</p> : null}

          <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-line bg-panel-raised px-2.5 py-1.5">
            <span className="min-w-0 truncate text-[11.5px] text-ink-muted" data-testid="workspace-path">
              工作区：
              <span className="font-mono text-ink">
                {workspace ?? '自动（每次新建干净目录并复制示例数据）'}
              </span>
            </span>
            <Button
              size="sm"
              data-testid="choose-workspace"
              onClick={() => {
                void getTransport()
                  .chooseWorkspace()
                  .then((result) => {
                    if (result.ok) setWorkspace(result.value.path)
                  })
              }}
            >
              选择…
            </Button>
          </div>

          {cards.length === 0 ? (
            <EmptyState compact title="没有可用任务卡" hint="把任务卡放进 tasks/ 目录后重新打开。" />
          ) : (
            <ul className="max-h-72 overflow-auto">
              {cards.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void pick(card)}
                    className="group flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-[var(--dur-fast)] hover:bg-panel-muted disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px]">{card.title}</span>
                      <span className="block truncate font-mono text-[10.5px] text-ink-faint">
                        {card.chain} · {card.id}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-accent opacity-0 transition-opacity group-hover:opacity-100">
                      开始 →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

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
