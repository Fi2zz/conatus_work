import { useState } from 'react'
import type { JSX } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/features/prototype/PageHeader'
import { AUTOMATIONS, type Automation, type AutomationLog } from '@/mock/data'

const EMPTY_FORM = { name: '', schedule: '每天 09:00', workspace: '~/Work', prompt: '' }

function logNow(): AutomationLog {
  return {
    id: `log-${Date.now()}`,
    at: '刚刚',
    status: 'succeeded',
    note: '手动测试运行完成（原型，不会真的执行）',
  }
}

export function AutomationPage(): JSX.Element {
  const [items, setItems] = useState<Automation[]>(() => AUTOMATIONS.map((item) => ({ ...item })))
  const [historyOf, setHistoryOf] = useState<Automation | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [notice, setNotice] = useState<string | null>(null)

  const active = items.filter((item) => item.status === 'active').length

  function patch(id: string, changes: Partial<Automation>): void {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)))
  }

  function toggle(item: Automation): void {
    const status = item.status === 'active' ? 'paused' : 'active'
    patch(item.id, { status, nextRun: status === 'active' ? '下次按计划触发' : '已暂停' })
    setNotice(`「${item.name}」已${status === 'active' ? '恢复' : '暂停'}。`)
  }

  function runNow(item: Automation): void {
    patch(item.id, { history: [logNow(), ...item.history] })
    setNotice(`「${item.name}」已触发一次测试运行（原型）。`)
  }

  function create(): void {
    const name = form.name.trim()
    if (name === '') {
      setNotice('请先填写自动化名称。')
      return
    }
    setItems((current) => [
      {
        id: `auto-${Date.now()}`,
        name,
        schedule: form.schedule,
        workspace: form.workspace,
        prompt: form.prompt,
        status: 'active',
        nextRun: '等待首次触发',
        history: [],
      },
      ...current,
    ])
    setCreateOpen(false)
    setForm(EMPTY_FORM)
    setNotice(`已创建「${name}」（原型：不会真的注册定时任务）。`)
  }

  return (
    <div data-testid="automation-page" className="flex flex-col gap-3">
      <PageHeader
        title="自动化"
        description={`按计划重复执行任务，适合日报、周报、定时整理。原型展示 ${items.length} 个任务，其中 ${active} 个启用；运行与创建都不会真正落盘。`}
        action={<Button size="sm" variant="primary" data-testid="automation-create" onClick={() => setCreateOpen(true)}>添加自动化</Button>}
      />

      {notice ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-1.5 text-[11px] text-accent">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-[10px] text-ink-muted hover:text-ink">
            关闭
          </button>
        </div>
      ) : null}

      <ul data-testid="automation-list" className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id} data-testid="automation-card" className="rounded-lg border border-line bg-panel px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[12.5px] font-medium">{item.name}</span>
                  <Badge tone={item.status === 'active' ? 'success' : 'neutral'}>
                    {item.status === 'active' ? '启用' : '已暂停'}
                  </Badge>
                  <span className="text-[10px] text-ink-faint">{item.schedule}</span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-muted">{item.prompt}</p>
                <p className="mt-1 text-[10px] text-ink-faint">
                  {item.workspace} · 下次：{item.nextRun} · 历史 {item.history.length} 次
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" data-testid="automation-run" onClick={() => runNow(item)}>立即运行</Button>
                <Button size="sm" data-testid="automation-toggle" onClick={() => toggle(item)}>
                  {item.status === 'active' ? '暂停' : '恢复'}
                </Button>
                <Button size="sm" variant="quiet" data-testid="automation-history" onClick={() => setHistoryOf(item)}>
                  历史
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={historyOf !== null} onOpenChange={(open) => !open && setHistoryOf(null)}>
        {historyOf ? (
          <DialogContent labelledBy="automation-history-title" className="w-[520px]">
            <DialogTitle id="automation-history-title">{historyOf.name} · 运行历史</DialogTitle>
            {historyOf.history.length === 0 ? (
              <p className="text-[11.5px] text-ink-muted">还没有运行记录。</p>
            ) : (
              <ul data-testid="automation-history-list" className="flex max-h-72 flex-col gap-1.5 overflow-auto">
                {historyOf.history.map((log) => (
                  <li key={log.id} className="flex items-start gap-2 rounded-md border border-line px-2 py-1.5 text-[11px]">
                    <Badge tone={log.status === 'succeeded' ? 'success' : 'danger'}>
                      {log.status === 'succeeded' ? '成功' : '失败'}
                    </Badge>
                    <span className="shrink-0 text-ink-faint">{log.at}</span>
                    <span className="text-ink-muted">{log.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent labelledBy="automation-create-title" className="w-[520px]">
          <DialogTitle id="automation-create-title">添加自动化</DialogTitle>
          <div className="flex flex-col gap-2 text-[11.5px]">
            <label className="flex flex-col gap-1">
              <span className="label-micro">名称</span>
              <input
                data-testid="automation-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="例如：每日 AI 简报"
                className="h-7 rounded-md border border-line bg-canvas px-2 text-[12px] outline-none focus:border-accent/60"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="label-micro">执行频率</span>
              <select
                value={form.schedule}
                onChange={(event) => setForm((current) => ({ ...current, schedule: event.target.value }))}
                className="h-7 rounded-md border border-line bg-canvas px-2 text-[12px] outline-none focus:border-accent/60"
              >
                <option>每天 09:00</option>
                <option>每周五 17:00</option>
                <option>每隔 6 小时</option>
                <option>单次执行</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="label-micro">工作区</span>
              <input
                value={form.workspace}
                onChange={(event) => setForm((current) => ({ ...current, workspace: event.target.value }))}
                className="h-7 rounded-md border border-line bg-canvas px-2 text-[12px] outline-none focus:border-accent/60"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="label-micro">提示词</span>
              <textarea
                data-testid="automation-prompt"
                value={form.prompt}
                onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
                rows={3}
                placeholder="写清目标、输入、输出格式和保存位置"
                className="resize-none rounded-md border border-line bg-canvas px-2 py-1 text-[12px] outline-none focus:border-accent/60"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" onClick={() => setCreateOpen(false)}>取消</Button>
              <Button size="sm" variant="primary" data-testid="automation-save" onClick={create}>保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
