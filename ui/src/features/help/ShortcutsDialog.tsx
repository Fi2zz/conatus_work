import type { JSX } from 'react'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useUiStore } from '@/state/ui-state'

const SHORTCUTS: Array<[string, string]> = [
  ['⌘K', '切换任务'],
  ['⌘N', '新建任务'],
  ['⌘Z', '打开撤销确认（不直接执行）'],
  ['⌘.', '停止当前运行'],
  ['⌘F', '搜索执行过程'],
  ['⌘↵', '发送消息'],
  ['Esc', '关闭弹窗 / 退出全屏'],
  ['?', '打开这个快捷键表'],
]

export function ShortcutsDialog(): JSX.Element {
  const open = useUiStore((state) => state.shortcutsOpen)
  const setOpen = useUiStore((state) => state.setShortcutsOpen)

  if (!open) return <></>
  return (
    <Dialog open onOpenChange={setOpen}>
      <DialogContent labelledBy="shortcuts-title" className="w-[460px]">
        <DialogTitle id="shortcuts-title">快捷键</DialogTitle>
        <ul data-testid="shortcuts-list" className="flex flex-col gap-1 text-[12px]">
          {SHORTCUTS.map(([keys, label]) => (
            <li key={keys} className="flex items-center justify-between gap-3 rounded-md px-2 py-1 hover:bg-panel-muted">
              <span className="text-ink-muted">{label}</span>
              <kbd className="rounded border border-line bg-panel-muted px-1.5 py-0.5 font-mono text-[10.5px] text-ink">
                {keys}
              </kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
