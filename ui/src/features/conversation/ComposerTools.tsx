import { useState } from 'react'
import type { JSX } from 'react'

type Menu = 'attach' | 'mention' | 'skill' | null

const OPTIONS: Record<Exclude<Menu, null>, string[]> = {
  attach: ['会议纪要.docx', '销售数据.xlsx', '截图 2026-11-04.png'],
  mention: ['@当前工作区', '@上一条消息', '@产物 changes.md'],
  skill: ['/调研报告', '/数据分析', '/文件整理'],
}

const LABELS: Record<Exclude<Menu, null>, string> = {
  attach: '添加附件',
  mention: '引用上下文',
  skill: '调用技能',
}

interface ComposerToolsProps {
  disabled: boolean
  onAttach: (name: string) => void
  onInsert: (text: string) => void
}

/** 输入框工具栏：附件、@ 引用、/ 技能。原型只改本地状态。 */
export function ComposerTools({ disabled, onAttach, onInsert }: ComposerToolsProps): JSX.Element {
  const [menu, setMenu] = useState<Menu>(null)

  function choose(option: string): void {
    if (menu === 'attach') onAttach(option)
    else onInsert(option)
    setMenu(null)
  }

  return (
    <div className="relative flex items-center gap-1">
      <button
        type="button"
        data-testid="composer-attach"
        disabled={disabled}
        onClick={() => setMenu(menu === 'attach' ? null : 'attach')}
        className="rounded-sm px-1 text-[12px] text-ink-muted hover:bg-panel-muted hover:text-ink disabled:opacity-50"
      >
        ＋
      </button>
      <button
        type="button"
        data-testid="composer-mention"
        disabled={disabled}
        onClick={() => setMenu(menu === 'mention' ? null : 'mention')}
        className="rounded-sm px-1 text-[10.5px] text-ink-muted hover:bg-panel-muted hover:text-ink disabled:opacity-50"
      >
        @ 引用
      </button>
      <button
        type="button"
        data-testid="composer-skill"
        disabled={disabled}
        onClick={() => setMenu(menu === 'skill' ? null : 'skill')}
        className="rounded-sm px-1 text-[10.5px] text-ink-muted hover:bg-panel-muted hover:text-ink disabled:opacity-50"
      >
        / 技能
      </button>

      {menu ? (
        <div
          data-testid="composer-tool-menu"
          className="absolute bottom-full left-0 z-20 mb-1 w-56 rounded-md border border-line bg-panel p-1 shadow-panel"
        >
          <p className="px-2 py-1 text-[10px] text-ink-faint">{LABELS[menu]}</p>
          {OPTIONS[menu].map((option) => (
            <button
              key={option}
              type="button"
              data-testid="composer-option"
              onClick={() => choose(option)}
              className="flex w-full items-center rounded-sm px-2 py-1 text-left text-[11.5px] hover:bg-panel-muted"
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
