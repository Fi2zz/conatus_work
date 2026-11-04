import { useState } from 'react'
import type { JSX } from 'react'

import { Button } from '@/components/ui/button'
import { PageHeader } from '@/features/prototype/PageHeader'
import { ARCHIVED_TASKS, STORAGE, STORAGE_LIMIT, type ArchivedTask, type StorageSlice } from '@/mock/data'

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`
  return `${Math.round(bytes / 1000)} KB`
}

export function DataPage(): JSX.Element {
  const [slices, setSlices] = useState<StorageSlice[]>(() => STORAGE.map((slice) => ({ ...slice })))
  const [archived, setArchived] = useState<ArchivedTask[]>(() => ARCHIVED_TASKS.map((task) => ({ ...task })))
  const [notice, setNotice] = useState<string | null>(null)

  const used = slices.reduce((total, slice) => total + slice.bytes, 0)
  const percent = Math.min(100, Math.round((used / STORAGE_LIMIT) * 100))

  function clearCache(): void {
    setSlices((current) => current.map((slice) => (slice.label === '缓存' ? { ...slice, bytes: 0 } : slice)))
    setNotice('已清理缓存（原型：不会删除本地文件）。')
  }

  return (
    <div data-testid="data-page" className="flex flex-col gap-3">
      <PageHeader
        title="数据管理"
        description="查看本地存储占用、已归档任务与清理入口。原型只改界面上的数字，不会删除或导出任何真实数据。"
        action={<Button size="sm" onClick={() => setNotice('导出数据是原型入口，后续可导出归档任务与运行记录。')}>导出数据</Button>}
      />

      {notice ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-1.5 text-[11px] text-accent">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-[10px] text-ink-muted hover:text-ink">
            关闭
          </button>
        </div>
      ) : null}

      <section data-testid="data-storage" className="rounded-lg border border-line bg-panel p-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="label-micro">本地存储</p>
            <p className="mt-1 text-[13px] font-medium tnum">
              {formatBytes(used)}
              <span className="ml-1 text-[10.5px] font-normal text-ink-faint">/ {formatBytes(STORAGE_LIMIT)}</span>
            </p>
          </div>
          <Button size="sm" data-testid="data-clear" onClick={clearCache}>清理缓存</Button>
        </div>
        <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-muted">
          <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
        </div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {slices.map((slice) => {
            const share = used === 0 ? 0 : Math.round((slice.bytes / used) * 100)
            return (
              <li key={slice.label} className="flex items-center gap-2 text-[11px]">
                <span className="w-24 shrink-0 text-ink-muted">{slice.label}</span>
                <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-panel-muted">
                  <span className="block h-full rounded-full bg-accent/60" style={{ width: `${share}%` }} />
                </span>
                <span className="w-16 shrink-0 text-right text-ink-faint tnum">{formatBytes(slice.bytes)}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="rounded-lg border border-line bg-panel p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="label-micro">已归档任务</p>
          <span className="text-[10px] text-ink-faint tnum">{archived.length} 条</span>
        </div>
        {archived.length === 0 ? (
          <p className="mt-2 text-[11.5px] text-ink-muted">没有归档任务。</p>
        ) : (
          <ul data-testid="archive-list" className="mt-2 flex flex-col gap-1">
            {archived.map((task) => (
              <li key={task.id} data-testid="archive-item" className="flex items-center gap-2 rounded-md px-1 py-1.5 text-[11.5px] hover:bg-panel-muted">
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                <span className="shrink-0 text-[10px] text-ink-faint">{task.chain} · {task.archivedAt}</span>
                <Button
                  size="sm"
                  variant="quiet"
                  data-testid="archive-restore"
                  onClick={() => {
                    setArchived((current) => current.filter((item) => item.id !== task.id))
                    setNotice(`已恢复「${task.title}」（原型）。`)
                  }}
                >
                  恢复
                </Button>
                <Button
                  size="sm"
                  variant="quiet"
                  data-testid="archive-delete"
                  onClick={() => {
                    setArchived((current) => current.filter((item) => item.id !== task.id))
                    setNotice(`已删除归档「${task.title}」（原型）。`)
                  }}
                >
                  删除
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
