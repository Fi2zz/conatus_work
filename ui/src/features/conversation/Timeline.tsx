import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'

import { getTransport, hasTransport } from '@/bridge/transport-store'
import type { TimelineEntry } from '@/bridge/types'
import { EmptyState } from '@/components/ui/empty-state'
import { formatOffset } from '@/lib/time'
import { entryText, filterByText, filterTimeline, groupConsecutiveTools } from '@/state/selectors'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench } from '@/state/workbench-store'
import { EntryRow } from './TimelineEntry'
import { FilterToggle } from './FilterToggle'

interface TimelineProps {
  unknownEvents?: number
}

type UserEntry = Extract<TimelineEntry, { kind: 'user' }>

function rowId(entry: TimelineEntry): string {
  return `entry-${entry.kind}-${entry.id}`
}

async function copyText(text: string): Promise<void> {
  try {
    await globalThis.navigator?.clipboard?.writeText(text)
  } catch {
    // 剪贴板不可用时仍然给出「已复制」反馈，避免重复点击。
  }
}

export function Timeline({ unknownEvents }: TimelineProps = {}): JSX.Element {
  const run = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId] : undefined))
  const counter = useWorkbench((state) => state.unknownEvents)
  const filter = useUiStore((state) => state.filter)
  const expandedKeys = useUiStore((state) => state.expandedKeys)
  const toggleExpanded = useUiStore((state) => state.toggleExpanded)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [newCount, setNewCount] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const setDraft = useUiStore((state) => state.setComposerDraft)
  const pending = unknownEvents ?? counter
  const running = run?.status === 'running' || run?.status === 'pending'
  const canRetry = hasTransport() && getTransport().mode === 'host' && !running

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setHistoryOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  const grouped = run ? groupConsecutiveTools(run.timeline, expandedKeys) : []
  const filtered = filterTimeline(grouped, query.trim() === '' ? filter : 'all')
  const entries = filterByText(filtered, query)
  const users: UserEntry[] = run
    ? run.timeline.filter((entry): entry is UserEntry => entry.kind === 'user')
    : []

  function jump(entry: UserEntry): void {
    setHistoryOpen(false)
    document.getElementById(rowId(entry))?.scrollIntoView?.({ block: 'center' })
  }

  function copy(entry: TimelineEntry): void {
    void copyText(entryText(entry))
    setCopiedId(rowId(entry))
  }

  useEffect(() => {
    const node = listRef.current
    if (!node) return
    if (atBottom) {
      node.scrollTop = node.scrollHeight
      setNewCount(0)
    } else {
      setNewCount((count) => count + 1)
    }
  }, [entries.length, atBottom])

  function onScroll(): void {
    const node = listRef.current
    if (!node) return
    const bottom = node.scrollHeight - node.scrollTop - node.clientHeight < 48
    setAtBottom(bottom)
    if (bottom) setNewCount(0)
  }

  function scrollToBottom(): void {
    const node = listRef.current
    if (!node) return
    node.scrollTo?.({ top: node.scrollHeight, behavior: 'smooth' })
    setAtBottom(true)
    setNewCount(0)
  }

  function quote(entry: TimelineEntry): void {
    const text = entryText(entry).replace(/\n/g, '\n> ')
    setDraft(`> ${text}\n\n`)
  }

  async function retry(entry: UserEntry): Promise<void> {
    if (!run || !canRetry) return
    setActionError(null)
    const result = await getTransport().sendMessage(run.id, entry.text)
    if (!result.ok) setActionError(`重发失败：${result.error.message}`)
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="relative flex items-center justify-between border-b border-line/70 px-3 py-1.5">
        <span className="label-micro">执行过程</span>
        <div className="flex items-center gap-1.5">
          {import.meta.env.DEV && pending > 0 ? (
            <span data-testid="unknown-events-badge" className="text-[10px] text-warning tnum">
              未知事件 {pending}
            </span>
          ) : null}
          <button
            type="button"
            data-testid="timeline-search-toggle"
            aria-pressed={searchOpen}
            onClick={() => setSearchOpen((value) => !value)}
            className="rounded-sm px-1 text-[10.5px] text-ink-muted hover:bg-panel-muted hover:text-ink"
          >
            搜索
          </button>
          <button
            type="button"
            data-testid="history-toggle"
            aria-pressed={historyOpen}
            onClick={() => setHistoryOpen((value) => !value)}
            className="rounded-sm px-1 text-[10.5px] text-ink-muted hover:bg-panel-muted hover:text-ink"
          >
            提问
          </button>
          <FilterToggle />
        </div>
        {historyOpen ? (
          <div
            data-testid="history-menu"
            className="absolute top-full right-2 z-10 mt-1 max-h-64 w-72 overflow-auto rounded-md border border-line bg-panel p-1 shadow-panel"
          >
            {users.length === 0 ? (
              <p className="px-2 py-1 text-[11px] text-ink-muted">还没有用户消息。</p>
            ) : (
              users.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  data-testid="history-item"
                  onClick={() => jump(entry)}
                  className="flex w-full items-baseline gap-2 rounded-sm px-2 py-1 text-left hover:bg-panel-muted"
                >
                  <span className="shrink-0 text-[10px] text-ink-faint tnum">{formatOffset(entry.at)}</span>
                  <span className="truncate text-[11.5px]">{entry.text}</span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      {searchOpen ? (
        <div className="flex items-center gap-2 border-b border-line/70 px-3 py-1">
          <input
            ref={searchRef}
            data-testid="timeline-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索过程（⌘F）"
            className="h-6 min-w-0 flex-1 rounded-md border border-line bg-canvas px-2 text-[11px] outline-none placeholder:text-ink-faint focus:border-accent/60"
          />
          {query.trim() !== '' ? (
            <span data-testid="timeline-search-count" className="shrink-0 text-[10px] text-ink-faint tnum">
              {entries.length} 条
            </span>
          ) : null}
        </div>
      ) : null}

      {actionError ? (
        <p data-testid="timeline-action-error" role="alert" className="border-b border-line/70 px-3 py-1 text-[10.5px] text-danger">
          {actionError}
        </p>
      ) : null}

      <div ref={listRef} data-testid="timeline-list" onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {entries.length === 0 ? (
          <EmptyState
            title={run ? (query.trim() === '' ? '还没有过程记录' : '没有匹配的记录') : '未选择任务'}
            hint={
              run
                ? query.trim() === ''
                  ? '任务开始执行后，消息与工具调用会按时间顺序出现在这里。'
                  : '换个关键词，或清空搜索。'
                : '从左侧选一条运行，看它的完整过程。'
            }
          />
        ) : (
          <div className="flex flex-col">
            {entries.map((entry) => {
              const id = rowId(entry)
              return (
                <div key={`${entry.kind}-${entry.id}`} id={id} className="timeline-row group relative">
                  <EntryRow
                    entry={entry}
                    expanded={expandedKeys.has(entry.id)}
                    onToggle={toggleExpanded}
                  />
                  <button
                    type="button"
                    data-testid="copy-entry"
                    onClick={() => copy(entry)}
                    className="absolute top-1 right-1 rounded-sm px-1 text-[10px] text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-panel-muted hover:text-ink focus:opacity-100"
                  >
                    {copiedId === id ? '已复制' : '复制'}
                  </button>
                  {entry.kind === 'user' || entry.kind === 'assistant' ? (
                    <button
                      type="button"
                      data-testid="quote-entry"
                      onClick={() => quote(entry)}
                      className="absolute top-1 right-10 rounded-sm px-1 text-[10px] text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-panel-muted hover:text-ink focus:opacity-100"
                    >
                      引用
                    </button>
                  ) : null}
                  {entry.kind === 'user' && canRetry ? (
                    <button
                      type="button"
                      data-testid="retry-entry"
                      onClick={() => void retry(entry)}
                      className="absolute top-1 right-[4.1rem] rounded-sm px-1 text-[10px] text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-panel-muted hover:text-ink focus:opacity-100"
                    >
                      重发
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!atBottom ? (
        <button
          type="button"
          data-testid="scroll-bottom"
          onClick={scrollToBottom}
          className="absolute right-3 bottom-3 z-10 rounded-full border border-line bg-panel px-2.5 py-1 text-[10.5px] text-ink-muted shadow-panel hover:text-ink"
        >
          回到最新{newCount > 0 ? ` (${newCount})` : ''}
        </button>
      ) : null}
    </div>
  )
}
