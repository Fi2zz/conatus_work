import type { JSX, ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'

interface PageHeaderProps {
  title: string
  description: string
  action?: ReactNode
  badge?: string
}

export function PageHeader({ title, description, action, badge }: PageHeaderProps): JSX.Element {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-line/70 pb-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h1>
          <Badge tone="warning">{badge ?? '原型数据'}</Badge>
        </div>
        <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-ink-muted">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
