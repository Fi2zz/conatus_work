import { useState } from 'react'
import type { JSX, KeyboardEvent } from 'react'

import type { RunSummary } from '@/bridge/types'
import { cn } from '@/lib/utils'
import { STATUS, duration } from './task-list-helpers'

interface TaskRowProps {
  run: RunSummary
  active: boolean
  index: number
  pinned: boolean
  batchMode: boolean
  selected: boolean
  archiveView: boolean
  onSelect: (runId: string) => void
  onTogglePin: (runId: string) => void
  onToggleSelected: (runId: string) => void
  onRename: (runId: string, title: string) => void
  onArchive: (runId: string) => void
  onRestore: (runId: string) => void
}

const MENU_ITEMS = [
  { id: 'rename', label: '重命名' },
  { id: 'open', label: '打开文件夹' },
  { id: 'archive', label: '归档' },
  { id: 'delete', label: '删除' },
] as const

type MenuId = (typeof MENU_ITEMS)[number]['id']

export function TaskRow({
  run,
  active,
  index,
  pinned,
  batchMode,
  selected,
  archiveView,
  onSelect,
  onTogglePin,
  onToggleSelected,
  onRename,
  onArchive,
  onRestore,
}: TaskRowProps): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(run.title)

  function commitRename(): void {
    const title = draft.trim()
    if (title !== '') onRename(run.id, title)
    setRenaming(false)
  }

  function onRenameKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') commitRename()
    if (event.key === 'Escape') setRenaming(false)
  }

  function choose(id: MenuId): void {
    setMenuOpen(false)
    if (id === 'rename') {
      setDraft(run.title)
      setRenaming(true)
      return
    }
    if (id === 'archive' || id === 'delete') {
      onArchive(run.id)
    }
  }

  return (
    <div className="group relative">
      {renaming ? (
        <div className="flex items-center gap-1 rounded-md border border-accent/40 bg-panel px-2 py-1.5">
          <input
            autoFocus
            data-testid="task-rename-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onRenameKey}
            className="h-6 min-w-0 flex-1 rounded-sm border border-line bg-canvas px-1.5 text-[12px] outline-none focus:border-accent/60"
          />
          <button type="button" onClick={commitRename} className="rounded-sm px-1.5 text-[10.5px] text-accent">
            确定
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => (batchMode ? onToggleSelected(run.id) : onSelect(run.id))}
          style={{ animationDelay: `${Math.min(index, 8) * 18}ms` }}
          className={cn(
            'rise relative w-full rounded-md px-2 py-1.5 pr-10 text-left transition-colors duration-[var(--dur-fast)]',
            active && !batchMode ? 'bg-panel shadow-panel' : 'hover:bg-panel/70',
            selected && 'bg-accent/10',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'absolute inset-y-1.5 left-0 w-[2px] rounded-full transition-colors',
              active && !batchMode ? 'bg-accent' : 'bg-transparent',
            )}
          />
          <div className="flex items-center gap-1.5 pl-1.5">
            {batchMode ? (
              <span
                data-testid="task-check"
                aria-checked={selected}
                className={cn(
                  'flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px] border text-[8px]',
                  selected ? 'border-accent bg-accent text-white' : 'border-line-strong text-transparent',
                )}
              >
                ✓
              </span>
            ) : (
              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS[run.status].dot)} />
            )}
            <span className="truncate text-[12.5px] leading-snug">{run.title}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 pl-4 text-[10.5px] text-ink-muted tnum">
            <span>{STATUS[run.status].label}</span>
            <span className="text-ink-faint">·</span>
            <span>{duration(run)}</span>
            <span className="text-ink-faint">·</span>
            <span>${run.usage.costUsd.toFixed(4)}</span>
          </div>
        </button>
      )}

      {renaming || batchMode ? null : archiveView ? (
        <button
          type="button"
          data-testid="task-restore"
          onClick={() => onRestore(run.id)}
          className="absolute top-1 right-1 rounded-sm px-1 text-[10px] text-accent hover:bg-panel-muted"
        >
          恢复
        </button>
      ) : (
        <div className="absolute top-1 right-1 flex items-center gap-0.5">
          <button
            type="button"
            data-testid="pin-task"
            aria-label={pinned ? '取消置顶' : '置顶任务'}
            aria-pressed={pinned}
            onClick={() => onTogglePin(run.id)}
            className={cn(
              'rounded-sm px-1 text-[11px] transition-opacity',
              pinned ? 'text-accent opacity-100' : 'text-ink-faint opacity-0 group-hover:opacity-100',
            )}
          >
            {pinned ? '★' : '☆'}
          </button>
          <button
            type="button"
            data-testid="task-menu"
            aria-label="任务操作"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
            className="rounded-sm px-1 text-[11px] text-ink-faint opacity-0 group-hover:opacity-100 hover:text-ink"
          >
            ···
          </button>
        </div>
      )}

      {menuOpen ? (
        <div
          data-testid="task-menu-panel"
          className="absolute top-6 right-1 z-20 flex w-32 flex-col rounded-md border border-line bg-panel p-1 shadow-panel"
        >
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`task-${item.id}`}
              onClick={() => choose(item.id)}
              className="rounded-sm px-2 py-1 text-left text-[11px] hover:bg-panel-muted"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
