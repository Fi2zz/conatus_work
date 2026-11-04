import { useState } from 'react'
import type { JSX } from 'react'

import { PageHeader } from '@/features/prototype/PageHeader'
import { cn } from '@/lib/utils'
import { AboutSettings } from './AboutSettings'
import { DataSettings } from './DataSettings'
import { GeneralSettings } from './GeneralSettings'
import { ModelSettings } from './ModelSettings'

type Section = 'model' | 'general' | 'data' | 'about'

const SECTIONS: Array<{ id: Section; label: string; hint: string }> = [
  { id: 'model', label: '模型', hint: '端点、Key、价格' },
  { id: 'general', label: '通用', hint: '主题、默认工作区' },
  { id: 'data', label: '数据', hint: '存储、检查点' },
  { id: 'about', label: '关于', hint: '版本、诊断' },
]

export function SettingsPage(): JSX.Element {
  const [section, setSection] = useState<Section>('model')

  return (
    <div data-testid="settings-page" className="flex flex-col gap-4">
      <PageHeader
        title="设置"
        description="模型配置写入宿主；主题、默认工作区等保存在浏览器本地；数据与检查点相关统计为原型。"
        badge="部分原型"
      />

      <div className="flex gap-5">
        <nav aria-label="设置分区" className="w-40 shrink-0">
          <ul className="flex flex-col gap-0.5">
            {SECTIONS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  data-testid={`settings-nav-${item.id}`}
                  aria-current={section === item.id ? 'page' : undefined}
                  onClick={() => setSection(item.id)}
                  className={cn(
                    'flex w-full flex-col rounded-md px-2.5 py-1.5 text-left',
                    section === item.id ? 'bg-panel text-ink shadow-panel' : 'text-ink-muted hover:bg-panel/70',
                  )}
                >
                  <span className="text-[12px]">{item.label}</span>
                  <span className="text-[10px] text-ink-faint">{item.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 max-w-2xl flex-1 rounded-lg border border-line bg-panel p-4">
          {section === 'model' ? <ModelSettings /> : null}
          {section === 'general' ? <GeneralSettings /> : null}
          {section === 'data' ? <DataSettings /> : null}
          {section === 'about' ? <AboutSettings /> : null}
        </div>
      </div>
    </div>
  )
}
