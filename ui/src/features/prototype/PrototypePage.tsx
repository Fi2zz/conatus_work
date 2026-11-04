import type { JSX } from 'react'

import { useUiStore } from '@/state/ui-state'
import { AutomationPage } from '@/features/automation/AutomationPage'
import { ConnectorsPage } from '@/features/connectors/ConnectorsPage'
import { DataPage } from '@/features/data/DataPage'
import { ExpertsPage } from '@/features/experts/ExpertsPage'
import { SkillsPage } from '@/features/skills/SkillsPage'
import { PrototypeNav } from './PrototypeNav'

const PAGES = {
  experts: ExpertsPage,
  skills: SkillsPage,
  connectors: ConnectorsPage,
  automation: AutomationPage,
  data: DataPage,
} as const

export function PrototypePage(): JSX.Element {
  const module = useUiStore((state) => state.module)
  const Page = module === 'work' ? null : PAGES[module]
  if (!Page) return <></>
  return (
    <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
      <Page />
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
