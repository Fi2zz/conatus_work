import { useState } from 'react'
import type { JSX } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/features/prototype/PageHeader'
import { ChipBar, SearchField } from '@/features/prototype/SearchField'
import { EXPERTS, type Expert } from '@/mock/data'

const CATEGORIES = ['全部', ...new Set(EXPERTS.map((expert) => expert.category))]
const FILTERS = CATEGORIES.map((value) => ({ value, label: value }))

export function ExpertsPage(): JSX.Element {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('全部')
  const [selected, setSelected] = useState<Expert | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const needle = query.trim().toLowerCase()
  const visible = EXPERTS.filter((expert) => {
    if (category !== '全部' && expert.category !== category) return false
    if (needle === '') return true
    return `${expert.name} ${expert.blurb} ${expert.tags.join(' ')}`.toLowerCase().includes(needle)
  })

  function summon(expert: Expert): void {
    setSelected(null)
    setNotice(`已召唤「${expert.name}」。原型模式只展示入口，不会真的执行任务。`)
  }

  return (
    <div data-testid="experts-page" className="flex flex-col gap-3">
      <PageHeader
        title="专家中心"
        description="按领域选择单个专家或专家团；专家团由团长拆分任务、成员协作，再汇总交付。这里先展示信息架构与交互，数据为原型。"
        action={<Button size="sm" onClick={() => setNotice('创建专家是原型入口，后续接技能与角色配置。')}>创建专家</Button>}
      />

      {notice ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-1.5 text-[11px] text-accent">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-[10px] text-ink-muted hover:text-ink">
            关闭
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ChipBar options={FILTERS} value={category} onChange={setCategory} testId="expert-categories" />
        <SearchField value={query} onChange={setQuery} placeholder="搜索专家、能力或标签" testId="expert-search" />
      </div>

      <div data-testid="expert-grid" className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((expert) => (
          <button
            key={expert.id}
            type="button"
            data-testid="expert-card"
            onClick={() => setSelected(expert)}
            className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3 text-left transition-colors hover:border-accent/40 hover:bg-panel-raised"
          >
            <div className="flex items-start gap-2">
              <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/10 text-[13px] text-accent">
                {expert.kind === 'team' ? '⛬' : '✦'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[12.5px] font-medium">{expert.name}</span>
                  <Badge tone={expert.kind === 'team' ? 'warning' : 'neutral'}>
                    {expert.kind === 'team' ? '专家团' : '专家'}
                  </Badge>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-ink-muted">{expert.blurb}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {expert.tags.map((tag) => (
                <span key={tag} className="rounded-sm bg-panel-muted px-1.5 py-0.5 text-[10px] text-ink-muted">
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-auto flex items-center justify-between text-[10px] text-ink-faint">
              <span>{expert.examples.length} 个任务示例</span>
              <span className="text-accent">查看详情 →</span>
            </div>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-[11.5px] text-ink-muted">
          没有匹配的专家。
        </p>
      ) : null}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        {selected ? (
          <DialogContent labelledBy="expert-title" className="w-[520px]">
            <DialogTitle id="expert-title">{selected.name}</DialogTitle>
            <div className="flex flex-col gap-3 text-[12px]">
              <p className="text-ink-muted">{selected.blurb}</p>
              <div className="flex flex-wrap gap-1">
                {selected.tags.map((tag) => (
                  <Badge key={tag} tone="neutral">{tag}</Badge>
                ))}
              </div>
              <div>
                <p className="label-micro mb-1">任务示例</p>
                <ul className="list-disc pl-4 text-[11.5px] text-ink-muted">
                  {selected.examples.map((example) => (
                    <li key={example}>{example}</li>
                  ))}
                </ul>
              </div>
              {selected.members ? (
                <div>
                  <p className="label-micro mb-1">团队成员</p>
                  <ul className="flex flex-col gap-1">
                    {selected.members.map((member) => (
                      <li key={member.name} className="flex items-baseline gap-2 text-[11.5px]">
                        <span className="font-medium">{member.name}</span>
                        <span className="text-ink-muted">{member.role}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" onClick={() => setSelected(null)}>取消</Button>
                <Button size="sm" variant="primary" onClick={() => summon(selected)}>立即召唤</Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  )
}
