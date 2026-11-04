import { useState } from 'react'
import type { JSX } from 'react'

import { Button } from '@/components/ui/button'
import { STORAGE, STORAGE_LIMIT, type StorageSlice } from '@/mock/data'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench } from '@/state/workbench-store'

function size(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  return `${Math.round(bytes / 1_000_000)} MB`
}

export function DataSettings(): JSX.Element {
  const run = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId] : undefined))
  const setModule = useUiStore((state) => state.setModule)
  const [slices, setSlices] = useState<StorageSlice[]>(() => STORAGE.map((slice) => ({ ...slice })))
  const [notice, setNotice] = useState<string | null>(null)

  const used = slices.reduce((total, slice) => total + slice.bytes, 0)
  const percent = Math.min(100, Math.round((used / STORAGE_LIMIT) * 100))

  return (
    <section data-testid="settings-data" className="flex flex-col gap-3 text-[12px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12.5px] font-medium">存储</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            {size(used)} / {size(STORAGE_LIMIT)}（原型统计）
          </p>
        </div>
        <Button size="sm" data-testid="settings-open-data" onClick={() => setModule('data')}>
          打开数据管理
        </Button>
      </div>
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-panel-muted">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <ul className="flex flex-col gap-1">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center justify-between text-[11px]">
            <span className="text-ink-muted">{slice.label}</span>
            <span className="text-ink-faint tnum">{size(slice.bytes)}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-line/70 pt-3">
        <div>
          <p className="text-[12px]">检查点保留轮次</p>
          <p className="text-[10.5px] text-ink-muted">由运行记录决定，超出范围的轮次不可撤销。</p>
        </div>
        <span data-testid="settings-keep" className="text-[14px] font-semibold tnum">
          {run?.checkpoints.keep ?? 5}
        </span>
      </div>

      <div className="flex justify-between gap-2 border-t border-line/70 pt-3">
        <Button
          size="sm"
          variant="quiet"
          data-testid="settings-clear-cache"
          onClick={() => {
            setSlices((current) => current.map((slice) => (slice.label === '缓存' ? { ...slice, bytes: 0 } : slice)))
            setNotice('已清理缓存（原型，不删除真实文件）。')
          }}
        >
          清理缓存
        </Button>
        <Button size="sm" variant="quiet" onClick={() => setNotice('导出是原型入口，后续接真实数据。')}>
          导出数据
        </Button>
      </div>
      {notice ? <p data-testid="settings-data-status" className="text-[11px] text-ink-muted">{notice}</p> : null}
    </section>
  )
}
