import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import { getTransport, hasTransport } from '@/bridge/transport-store'
import type { TaskCard } from '@/bridge/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { useUiStore } from '@/state/ui-state'
import { useWorkbenchStore } from '@/state/workbench-store'

export function NewTaskDialog(): JSX.Element {
  const open = useUiStore((state) => state.newTaskOpen)
  const setOpen = useUiStore((state) => state.setNewTaskOpen)
  const adoptRun = useWorkbenchStore((store) => store.adoptRun)
  const [cards, setCards] = useState<TaskCard[]>([])
  const [error, setError] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !hasTransport()) return
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
              工作区：<span className="font-mono text-ink">{workspace ?? '任务卡默认'}</span>
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

export function SettingsDialog(): JSX.Element {
  const open = useUiStore((state) => state.settingsOpen)
  const setOpen = useUiStore((state) => state.setSettingsOpen)
  if (!open) return <></>
  return (
    <Dialog open onOpenChange={setOpen}>
      <DialogContent labelledBy="settings-title">
        <DialogTitle id="settings-title">设置</DialogTitle>
        <SettingsPage />
      </DialogContent>
    </Dialog>
  )
}
