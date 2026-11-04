import { useState } from 'react'
import type { JSX } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/features/prototype/PageHeader'
import { ChipBar, SearchField } from '@/features/prototype/SearchField'
import { CONNECTORS, type Connector } from '@/mock/data'

const CATEGORIES = ['全部', ...new Set(CONNECTORS.map((connector) => connector.category))]
const FILTERS = CATEGORIES.map((value) => ({ value, label: value }))

export function ConnectorsPage(): JSX.Element {
  const [items, setItems] = useState<Connector[]>(() => CONNECTORS.map((item) => ({ ...item })))
  const [category, setCategory] = useState('全部')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const needle = query.trim().toLowerCase()
  const visible = items.filter((item) => {
    if (category !== '全部' && item.category !== category) return false
    if (needle === '') return true
    return `${item.name} ${item.description}`.toLowerCase().includes(needle)
  })
  const connected = items.filter((item) => item.status === 'connected').length

  function patch(id: string, changes: Partial<Connector>): void {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)))
  }

  function toggle(item: Connector): void {
    if (item.status === 'connected') {
      patch(item.id, { status: 'disconnected', account: undefined })
      setNotice(`已断开「${item.name}」。`)
    } else {
      patch(item.id, { status: 'connected', account: 'fitzy@example.com' })
      setNotice(`已授权「${item.name}」（原型：不会真的走 OAuth）。`)
    }
  }

  function addMock(): void {
    if (items.some((item) => item.id === 'conn-feishu')) {
      setNotice('「飞书」已经在列表里了。')
      return
    }
    setItems((current) => [
      {
        id: 'conn-feishu',
        name: '飞书',
        category: '协作',
        description: '读取群消息与文档，发送通知和创建日程。',
        status: 'disconnected',
        tools: 10,
      },
      ...current,
    ])
    setNotice('已添加「飞书」连接器（原型）。')
  }

  return (
    <div data-testid="connectors-page" className="flex flex-col gap-3">
      <PageHeader
        title="连接器"
        description={`把外部服务通过 MCP 接进工作流。当前原型展示 ${items.length} 个连接器，已连接 ${connected} 个；授权与开关不会调用真实服务。`}
        action={<Button size="sm" variant="primary" onClick={addMock}>添加连接器</Button>}
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
        <ChipBar options={FILTERS} value={category} onChange={setCategory} testId="connector-categories" />
        <SearchField value={query} onChange={setQuery} placeholder="搜索连接器" testId="connector-search" />
      </div>

      <ul data-testid="connector-list" className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {visible.map((item) => (
          <li key={item.id} data-testid="connector-card" className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3">
            <div className="flex items-start gap-2">
              <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-panel-muted text-[12px]">
                {item.name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[12.5px] font-medium">{item.name}</span>
                  <Badge tone={item.status === 'connected' ? 'success' : 'neutral'}>
                    {item.status === 'connected' ? '已连接' : '未连接'}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">{item.description}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-ink-faint">
              <span>
                {item.category} · {item.tools} 个工具
                {item.account ? ` · ${item.account}` : ''}
              </span>
              <Button size="sm" data-testid="connector-toggle" onClick={() => toggle(item)}>
                {item.status === 'connected' ? '断开' : '授权'}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-[11.5px] text-ink-muted">
          没有匹配的连接器。
        </p>
      ) : null}
    </div>
  )
}
