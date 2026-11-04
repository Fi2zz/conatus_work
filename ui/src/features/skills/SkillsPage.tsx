import { useState } from 'react'
import type { JSX } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/features/prototype/PageHeader'
import { SearchField } from '@/features/prototype/SearchField'
import { SKILLS, type Skill } from '@/mock/data'

type Tab = 'installed' | 'market'

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'installed', label: '已安装' },
  { value: 'market', label: '推荐市场' },
]

export function SkillsPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>('installed')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Skill[]>(() => SKILLS.map((skill) => ({ ...skill })))
  const [notice, setNotice] = useState<string | null>(null)

  const needle = query.trim().toLowerCase()
  const visible = items.filter((skill) => {
    if (tab === 'installed' ? !skill.installed : skill.installed) return false
    if (needle === '') return true
    return `${skill.name} ${skill.description} ${skill.category}`.toLowerCase().includes(needle)
  })
  const installedCount = items.filter((skill) => skill.installed).length

  function patch(id: string, changes: Partial<Skill>): void {
    setItems((current) => current.map((skill) => (skill.id === id ? { ...skill, ...changes } : skill)))
  }

  function install(skill: Skill): void {
    patch(skill.id, { installed: true, enabled: true })
    setNotice(`已安装「${skill.name}」（原型：不会写入本地技能目录）。`)
  }

  function addMock(): void {
    if (items.some((skill) => skill.id === 'skill-new')) {
      setNotice('「会议速记」已经在列表里了。')
      return
    }
    setItems((current) => [
      {
        id: 'skill-new',
        name: '会议速记',
        category: '协作',
        description: '从录音转写中提取结论、待办与负责人，生成 Markdown 纪要。',
        version: '0.1.0',
        source: '本地',
        installed: true,
        enabled: true,
      },
      ...current,
    ])
    setTab('installed')
    setNotice('已导入「会议速记」（原型：跳过安全检测与落盘）。')
  }

  return (
    <div data-testid="skills-page" className="flex flex-col gap-3">
      <PageHeader
        title="技能"
        description="技能是给 Agent 的可复用流程与工具用法。这里展示安装、启停、卸载和市场入口；数据为原型，不会改动本地技能目录。"
        action={<Button size="sm" variant="primary" onClick={addMock}>添加技能</Button>}
      />

      {notice ? (
        <div data-testid="skill-notice" className="flex items-center justify-between gap-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-1.5 text-[11px] text-accent">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-[10px] text-ink-muted hover:text-ink">
            关闭
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="技能分组" className="flex items-center gap-1">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              data-testid={`skill-tab-${item.value}`}
              onClick={() => setTab(item.value)}
              className={
                tab === item.value
                  ? 'rounded-md bg-panel px-2.5 py-1 text-[11.5px] text-ink shadow-panel'
                  : 'rounded-md px-2.5 py-1 text-[11.5px] text-ink-muted hover:bg-panel-muted hover:text-ink'
              }
            >
              {item.label}
              <span className="ml-1 text-[10px] text-ink-faint tnum">
                {item.value === 'installed' ? installedCount : items.length - installedCount}
              </span>
            </button>
          ))}
        </div>
        <SearchField value={query} onChange={setQuery} placeholder="搜索技能" testId="skill-search" />
      </div>

      <ul data-testid="skill-list" className="flex flex-col gap-1.5">
        {visible.map((skill) => (
          <li key={skill.id} className="flex items-start gap-3 rounded-lg border border-line bg-panel px-3 py-2.5">
            <span aria-hidden className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-panel-muted text-[12px]">
              {skill.category.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12.5px] font-medium">{skill.name}</span>
                <Badge tone="neutral">{skill.category}</Badge>
                <span className="text-[10px] text-ink-faint tnum">v{skill.version}</span>
                <span className="text-[10px] text-ink-faint">· {skill.source}</span>
                {skill.installed ? (
                  <Badge tone={skill.enabled ? 'success' : 'neutral'}>{skill.enabled ? '已启用' : '已关闭'}</Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">{skill.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {skill.installed ? (
                <>
                  <Button
                    size="sm"
                    data-testid="skill-toggle"
                    onClick={() => patch(skill.id, { enabled: !skill.enabled })}
                  >
                    {skill.enabled ? '关闭' : '启用'}
                  </Button>
                  <Button
                    size="sm"
                    variant="quiet"
                    data-testid="skill-uninstall"
                    onClick={() => patch(skill.id, { installed: false, enabled: false })}
                  >
                    卸载
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="primary" data-testid="skill-install" onClick={() => install(skill)}>
                  安装
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-[11.5px] text-ink-muted">
          {tab === 'installed' ? '还没有安装技能。' : '市场里没有匹配的技能。'}
        </p>
      ) : null}
    </div>
  )
}
