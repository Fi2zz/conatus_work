import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TaskList } from '@/features/tasks/TaskList'
import { useUiStore } from '@/state/ui-state'

import { summaryOf } from '../helpers/transport'

function seed(): void {
  useUiStore.setState({ taskQuery: '', taskStatus: 'all' })
}

const runs = [
  summaryOf({ id: 'run-a', title: '整理收件箱', status: 'succeeded', startedAt: '2026-11-03T10:00:00+08:00' }),
  summaryOf({ id: 'run-b', title: '分析销售 CSV', status: 'failed', startedAt: '2026-11-02T10:00:00+08:00' }),
  summaryOf({ id: 'run-c', title: '调研报告', status: 'running', startedAt: '2026-11-01T10:00:00+08:00' }),
]

it('groups the newest day as 今天 and older ones separately', () => {
  seed()
  render(<TaskList runs={runs} activeId={null} onSelect={() => {}} />)
  expect(screen.getByText('今天')).toBeInTheDocument()
  expect(screen.getByText('更早')).toBeInTheDocument()
})

it('filters by status', async () => {
  seed()
  render(<TaskList runs={runs} activeId={null} onSelect={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: '失败' }))
  expect(screen.getByText('分析销售 CSV')).toBeInTheDocument()
  expect(screen.queryByText('整理收件箱')).not.toBeInTheDocument()
})

it('searches by title', async () => {
  seed()
  render(<TaskList runs={runs} activeId={null} onSelect={() => {}} />)
  await userEvent.type(screen.getByPlaceholderText('搜索任务'), '调研')
  expect(screen.getByText('调研报告')).toBeInTheDocument()
  expect(screen.queryByText('整理收件箱')).not.toBeInTheDocument()
})

it('explains when nothing matches and resets', async () => {
  seed()
  render(<TaskList runs={runs} activeId={null} onSelect={() => {}} />)
  await userEvent.type(screen.getByPlaceholderText('搜索任务'), '不存在的任务')
  expect(screen.getByTestId('task-list-filtered-empty')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '清除筛选' }))
  expect(screen.getByText('整理收件箱')).toBeInTheDocument()
})
