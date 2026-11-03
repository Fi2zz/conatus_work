import type { JSX } from 'react'

import { cn } from '@/lib/utils'

interface SkeletonProps {
  rows?: number
  className?: string
}

export function Skeleton({ rows = 3, className }: SkeletonProps): JSX.Element {
  return (
    <div data-testid="skeleton" className={cn('flex flex-col gap-2 p-3', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-3 animate-pulse rounded-sm bg-panel-muted"
          style={{ width: `${88 - index * 12}%`, animationDelay: `${index * 60}ms` }}
        />
      ))}
    </div>
  )
}
