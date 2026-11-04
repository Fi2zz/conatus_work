import { lazy, Suspense } from 'react'
import type { JSX, LazyExoticComponent } from 'react'

import { useUiStore, type AppModule } from '@/state/ui-state'
import { PrototypeNav } from './PrototypeNav'

type LazyPage = LazyExoticComponent<() => JSX.Element>
type ModulePage = Exclude<AppModule, 'work'>

const PAGES: Record<ModulePage, LazyPage> = {
  experts: lazy(() => import('@/features/experts/ExpertsPage').then((m) => ({ default: m.ExpertsPage }))),
  skills: lazy(() => import('@/features/skills/SkillsPage').then((m) => ({ default: m.SkillsPage }))),
  connectors: lazy(() =>
    import('@/features/connectors/ConnectorsPage').then((m) => ({ default: m.ConnectorsPage })),
  ),
  automation: lazy(() =>
    import('@/features/automation/AutomationPage').then((m) => ({ default: m.AutomationPage })),
  ),
  data: lazy(() => import('@/features/data/DataPage').then((m) => ({ default: m.DataPage }))),
}

export function PrototypePage(): JSX.Element {
  const module = useUiStore((state) => state.module)
  if (module === 'work') return <></>
  const Page = PAGES[module]
  return (
    <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
      <Suspense fallback={<p className="text-[11.5px] text-ink-muted">正在加载模块…</p>}>
        <Page />
      </Suspense>
    </div>
  )
}

/** 模块导航 + 当前模块内容；工作台模块仍由 Shell 承载。 */
export function AppFrame({ workbench }: { workbench: JSX.Element }): JSX.Element {
  const module = useUiStore((state) => state.module)
  return (
    <div className="flex h-full min-h-0 bg-canvas text-ink">
      <PrototypeNav />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {module === 'work' ? workbench : <PrototypePage />}
      </div>
    </div>
  )
}
