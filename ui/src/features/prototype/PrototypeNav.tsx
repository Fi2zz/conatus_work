import type { JSX } from 'react'

import { cn } from '@/lib/utils'
import { useUiStore, type AppModule } from '@/state/ui-state'

const ITEMS: Array<{ id: AppModule; glyph: string; label: string }> = [
  { id: 'work', glyph: '▦', label: '工作台' },
  { id: 'experts', glyph: '✦', label: '专家' },
  { id: 'skills', glyph: '▣', label: '技能' },
  { id: 'connectors', glyph: '⇄', label: '连接器' },
  { id: 'automation', glyph: '◷', label: '自动化' },
  { id: 'data', glyph: '▤', label: '数据' },
  { id: 'settings', glyph: '⚙', label: '设置' },
]

/** 左下角的模块导航；工作台保持现有三栏，其余模块是原型页。 */
export function PrototypeNav(): JSX.Element {
  const module = useUiStore((state) => state.module)
  const setModule = useUiStore((state) => state.setModule)

  return (
    <nav
      data-testid="module-nav"
      aria-label="模块导航"
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-panel-muted/70 py-2"
    >
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          data-testid={`module-${item.id}`}
          aria-pressed={module === item.id}
          onClick={() => setModule(item.id)}
          className={cn(
            'flex w-11 flex-col items-center gap-0.5 rounded-md py-1.5 transition-colors',
            module === item.id
              ? 'bg-panel text-accent shadow-panel'
              : 'text-ink-muted hover:bg-panel/70 hover:text-ink',
          )}
        >
          <span aria-hidden className="text-[13px] leading-none">
            {item.glyph}
          </span>
          <span className="text-[9.5px] leading-none">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
