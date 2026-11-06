import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'

import { getTransport, hasTransport } from '@/bridge/transport-store'
import type { TaskCard } from '@/bridge/types'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/state/ui-state'
import { useWorkbenchStore } from '@/state/workbench-store'
import {
  readDefaultWorkspace,
  readRecentWorkspaces,
  rememberWorkspace,
  saveDefaultWorkspace,
} from '@/lib/preferences'
import { ModelPicker } from './ModelPicker'

/** 新建任务 = 新建会话：不开弹窗，直接在中间区域输入第一句话。 */
export function NewSessionView(): JSX.Element {
  const setNewSessionOpen = useUiStore((state) => state.setNewSessionOpen)
  const [prompt, setPrompt] = useState('')
  const [workspace, setWorkspace] = useState<string | null>(() => readDefaultWorkspace())
  const [recent, setRecent] = useState<string[]>(() => readRecentWorkspaces())
  const [cards, setCards] = useState<TaskCard[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    area.current?.focus()
    if (!hasTransport()) return
    void getTransport()
      .listCards()
      .then((result) => {
        if (result.ok) setCards(result.value)
      })
      .catch(() => undefined)
  }, [])

  function pickWorkspace(path: string | null): void {
    setWorkspace(path)
    saveDefaultWorkspace(path)
    if (path) {
      rememberWorkspace(path)
      setRecent(readRecentWorkspaces())
    }
    setMenuOpen(false)
  }

  function chooseFolder(): void {
    if (!hasTransport()) return
    void getTransport()
      .chooseWorkspace()
      .then((result) => {
        if (result.ok) pickWorkspace(result.value.path)
      })
      .catch((cause: unknown) => setError(String(cause)))
  }

  async function adopt(runId: string): Promise<void> {
    const view = await getTransport().openTask(runId)
    if (view.ok) {
      useWorkbenchStore.getState().adoptRun(view.value)
      setNewSessionOpen(false)
    } else {
      setError(view.error.message)
    }
  }

  async function startFree(): Promise<void> {
    const text = prompt.trim()
    if (text === '' || busy) return
    const create = getTransport().createTask
    if (!create) {
      setError('当前宿主还不支持自由任务，请从下面的任务卡开始。')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const started = await create.call(getTransport(), text, workspace ?? undefined)
      if (!started.ok) {
        setError(started.error.message)
        return
      }
      await adopt(started.value.runId)
    } finally {
      setBusy(false)
    }
  }

  async function startCard(card: TaskCard): Promise<void> {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const started = await getTransport().startTask(card.id, workspace ?? undefined)
      if (!started.ok) {
        setError(started.error.message)
        return
      }
      await adopt(started.value.runId)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-testid="new-session" className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line/70 bg-panel px-4 py-2">
        <div className="min-w-0">
          <h1 className="text-[13.5px] font-semibold tracking-[-0.01em]">新会话</h1>
          <p className="text-[10.5px] text-ink-muted">描述任务后开始；也可以从任务卡模板进入。</p>
        </div>
        <div className="relative">
          <button
            type="button"
            data-testid="workspace-chip"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
            className="flex max-w-[18rem] items-center gap-1 rounded-md border border-line bg-panel px-2 py-1 text-[10.5px] text-ink-muted hover:bg-panel-muted hover:text-ink"
          >
            <span aria-hidden className="text-[9px]">
              ▣
            </span>
            <span className="truncate">{workspace ?? '自动工作区'}</span>
            <span aria-hidden className="text-[8px] text-ink-faint">
              ▼
            </span>
          </button>
          {menuOpen ? (
            <div
              data-testid="workspace-menu"
              className="absolute top-full right-0 z-20 mt-1 w-72 rounded-md border border-line bg-panel p-1 shadow-panel"
            >
              <button
                type="button"
                data-testid="workspace-option"
                onClick={() => pickWorkspace(null)}
                className="flex w-full flex-col rounded-sm px-2 py-1 text-left hover:bg-panel-muted"
              >
                <span className="text-[11.5px]">自动</span>
                <span className="text-[10px] text-ink-faint">每次新建干净目录</span>
              </button>
              {recent.map((path) => (
                <button
                  key={path}
                  type="button"
                  data-testid="workspace-option"
                  onClick={() => pickWorkspace(path)}
                  className="flex w-full items-center rounded-sm px-2 py-1 text-left hover:bg-panel-muted"
                >
                  <span className="truncate font-mono text-[10.5px]">{path}</span>
                </button>
              ))}
              <button
                type="button"
                data-testid="workspace-option"
                onClick={chooseFolder}
                className="mt-1 w-full rounded-sm border-t border-line/70 px-2 py-1 text-left text-[11px] text-accent hover:bg-panel-muted"
              >
                选择文件夹…
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <div>
            <h2 className="text-[20px] font-semibold tracking-[-0.02em]">想让我做什么？</h2>
            <p className="mt-1 text-[11.5px] text-ink-muted">
              说清目标、输入位置、输出格式和约束。工作区可在右上角切换。
            </p>
          </div>

          {error ? (
            <p data-testid="new-session-error" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-1.5 text-[11px] text-danger">
              {error}
            </p>
          ) : null}

          <div className="rounded-xl border border-line bg-canvas focus-within:border-accent">
            <textarea
              ref={area}
              data-testid="new-session-prompt"
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value)
                setError(null)
              }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault()
                  void startFree()
                }
              }}
              rows={7}
              placeholder="例如：分析 data/sales.csv，按月份和地区统计退款率，输出 out/analysis.md 和 chart.svg；不要联网。"
              className="composer-input min-h-[160px] w-full resize-none bg-transparent px-3 pt-3 pb-1 text-[13px] leading-relaxed outline-none placeholder:text-ink-faint"
            />
            <div className="flex items-center gap-1 px-2 pb-2">
              <ModelPicker disabled={busy} />
              <span className="ml-auto text-[9.5px] text-ink-faint">⌘↵ 开始</span>
              <Button
                size="sm"
                variant="primary"
                data-testid="new-session-start"
                disabled={busy || prompt.trim() === ''}
                onClick={() => void startFree()}
                className="h-7 w-7 shrink-0 rounded-full p-0 text-[14px]"
              >
                <span aria-hidden>{busy ? '…' : '↑'}</span>
              </Button>
            </div>
          </div>

          {cards.length > 0 ? (
            <div className="border-t border-line/70 pt-3">
              <p className="label-micro mb-1">任务卡模板</p>
              <div className="flex flex-wrap gap-1.5">
                {cards.slice(0, 8).map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    data-testid="template-card"
                    disabled={busy}
                    onClick={() => void startCard(card)}
                    className="max-w-full rounded-md border border-line px-2 py-1 text-left text-[11px] text-ink-muted hover:border-accent/40 hover:bg-panel-muted hover:text-ink disabled:opacity-50"
                  >
                    <span className="block truncate">{card.title}</span>
                    <span className="block truncate font-mono text-[9.5px] text-ink-faint">{card.chain}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
