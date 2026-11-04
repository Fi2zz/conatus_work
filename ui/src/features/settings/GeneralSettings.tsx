import { useState } from 'react'
import type { JSX } from 'react'

import { getTransport, hasTransport } from '@/bridge/transport-store'
import { Button } from '@/components/ui/button'
import {
  readDefaultWorkspace,
  readRestoreLast,
  saveDefaultWorkspace,
  saveRestoreLast,
} from '@/lib/preferences'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/state/ui-state'
import type { Theme } from '@/lib/theme'

const THEMES: Array<{ value: Theme; label: string }> = [
  { value: 'auto', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

export function GeneralSettings(): JSX.Element {
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)
  const [workspace, setWorkspace] = useState<string | null>(() => readDefaultWorkspace())
  const [restore, setRestore] = useState(() => readRestoreLast())
  const [status, setStatus] = useState<string | null>(null)

  function chooseWorkspace(): void {
    if (!hasTransport()) {
      setStatus('没有宿主连接，无法选择工作区。')
      return
    }
    void getTransport()
      .chooseWorkspace()
      .then((result) => {
        if (!result.ok) {
          setStatus(result.error.message)
          return
        }
        setWorkspace(result.value.path)
        saveDefaultWorkspace(result.value.path)
        setStatus(result.value.path ? '已设为默认工作区' : '已取消')
      })
      .catch((cause: unknown) => setStatus(String(cause)))
  }

  function removeWorkspace(): void {
    setWorkspace(null)
    saveDefaultWorkspace(null)
    setStatus('已清除默认工作区')
  }

  return (
    <section data-testid="settings-general" className="flex flex-col gap-4 text-[12px]">
      <div>
        <p className="text-[12.5px] font-medium">外观</p>
        <p className="mt-0.5 text-[11px] text-ink-muted">深色跟随系统；选择后写入 localStorage。</p>
        <div className="mt-2 flex gap-1">
          {THEMES.map((item) => (
            <button
              key={item.value}
              type="button"
              data-testid={`theme-${item.value}`}
              aria-pressed={theme === item.value}
              onClick={() => setTheme(item.value)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11px]',
                theme === item.value
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-line text-ink-muted hover:bg-panel-muted hover:text-ink',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-line/70 pt-3">
        <p className="text-[12.5px] font-medium">默认工作区</p>
        <p className="mt-0.5 text-[11px] text-ink-muted">新建任务时默认使用这个目录；仍可在弹窗里临时改。</p>
        <div className="mt-2 flex items-center gap-2 rounded-md border border-line bg-panel-muted/40 px-2.5 py-1.5">
          <span data-testid="settings-workspace" className="min-w-0 flex-1 truncate font-mono text-[11px]">
            {workspace ?? '未设置（每次新建干净目录）'}
          </span>
          <Button size="sm" data-testid="settings-choose-workspace" onClick={chooseWorkspace}>
            选择…
          </Button>
          {workspace ? (
            <Button size="sm" variant="quiet" data-testid="settings-clear-workspace" onClick={removeWorkspace}>
              清除
            </Button>
          ) : null}
        </div>
      </div>

      <div className="border-t border-line/70 pt-3">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            data-testid="settings-restore"
            checked={restore}
            onChange={(event) => {
              setRestore(event.target.checked)
              saveRestoreLast(event.target.checked)
            }}
            className="mt-0.5"
          />
          <span>
            <span className="block text-[12px]">打开时恢复上次任务</span>
            <span className="block text-[10.5px] text-ink-muted">原型开关；接线后由壳决定恢复策略。</span>
          </span>
        </label>
      </div>

      {status ? (
        <p data-testid="settings-general-status" className="text-[11px] text-ink-muted">
          {status}
        </p>
      ) : null}
    </section>
  )
}
