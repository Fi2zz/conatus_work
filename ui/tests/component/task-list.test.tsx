import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TaskList } from '@/features/tasks/TaskList'
import { useUiStore } from '@/state/ui-state'

import { summaryOf } from '../helpers/transport'

function seed(): void {
  globalThis.localStorage?.clear()
  useUiStore.setState({
    taskQuery: '',
    taskStatus: 'all',
    taskTime: 'all',
    pinnedTaskIds: [],
    taskTitles: {},
    archivedTaskIds: [],
    batchMode: false,
    selectedTaskIds: [],
    archiveView: false,
    taskGrouping: 'date',
  })
}

const runs = [
  summaryOf({ id: 'run-a', title: '整理收件箱', status: 'succeeded', chain: 'organize', startedAt: '2026-11-03T10:00:00+08:00' }),
  summaryOf({ id: 'run-b', title: '分析销售 CSV', status: 'failed', chain: 'csv', startedAt: '2026-11-02T10:00:00+08:00' }),
  summaryOf({ id: 'run-c', title: '调研报告', status: 'running', chain: 'research', startedAt: '2026-11-01T10:00:00+08:00' }),
]

it('groups the newest day as 今天 and older ones separately', () => {
  seed()
  render(<TaskList runs={runs} activeId={null} onSelect={() => {}} />)
  expect(screen.getByTestId('task-group-今天')).toBeInTheDocument()
  expect(screen.getByTestId('task-group-更早')).toBeInTheDocument()
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

it('filters by time window', async () => {
  seed()
  const now = Date.now()
  const daysAgo = (days: number): string => new Date(now - days * 86_400_000).toISOString()
  const recent = [
    summaryOf({ id: 'run-now', title: '刚刚的任务', startedAt: daysAgo(0) }),
    summaryOf({ id: 'run-old', title: '十天前的任务', startedAt: daysAgo(10) }),
    summaryOf({ id: 'run-ancient', title: '四十天前的任务', startedAt: daysAgo(40) }),
  ]
  render(<TaskList runs={recent} activeId={null} onSelect={() => {}} />)

  await userEvent.click(screen.getByTestId('task-time-today'))
  expect(screen.getByText('刚刚的任务')).toBeInTheDocument()
  expect(screen.queryByText('十天前的任务')).not.toBeInTheDocument()

  await userEvent.click(screen.getByTestId('task-time-week'))
  expect(screen.queryByText('十天前的任务')).not.toBeInTheDocument()

  await userEvent.click(screen.getByTestId('task-time-month'))
  expect(screen.getByText('十天前的任务')).toBeInTheDocument()
  expect(screen.queryByText('四十天前的任务')).not.toBeInTheDocument()
})

it('pins a task to the top and remembers it', async () => {
  seed()
  render(<TaskList runs={runs} activeId={null} onSelect={() => {}} />)
  await userEvent.click(screen.getAllByTestId('pin-task')[0])
  expect(screen.getByText('置顶')).toBeInTheDocument()
  expect(globalThis.localStorage?.getItem('conatus.pinnedTasks')).toContain('run-a')
  expect(useUiStore.getState().pinnedTaskIds).toEqual(['run-a'])
})

it('renames a task inline', async () => {
  seed()
  render(<TaskList runs={runs} activeId={null} onSelect={() => {}} />)
  await userEvent.click(screen.getAllByTestId('task-menu')[0])
  await userEvent.click(screen.getByTestId('task-rename'))
  const input = screen.getByTestId('task-rename-input')
  await userEvent.clear(input)
  await userEvent.type(input, '整理收件箱（第二轮）{Enter}')
  expect(screen.getByText('整理收件箱（第二轮）')).toBeInTheDocument()
  expect(useUiStore.getState().taskTitles['run-a']).toBe('整理收件箱（第二轮）')
})

it('archives a task from the row menu', async () => {
  seed()
  render(<TaskList runs={runs} activeId={null} onSelect={() => {}} />)
  await userEvent.click(screen.getAllByTestId('task-menu')[1])
  await userEvent.click(screen.getByTestId('task-archive'))
  expect(screen.queryByText('分析销售 CSV')).not.toBeInTheDocument()
  expect(useUiStore.getState().archivedTaskIds).toContain('run-b')
})

it('archives tasks in batch and restores them from the archive view', async () => {
  seed()
  render(<TaskList runs={runs} activeId={null} onSelect={() => {}} />)
  await userEvent.click(screen.getByTestId('task-batch-toggle'))
  await userEvent.click(screen.getByText('整理收件箱'))
  await userEvent.click(screen.getByText('分析销售 CSV'))
  expect(screen.getByTestId('task-batch-bar')).toHaveTextContent('已选 2')
  await userEvent.click(screen.getByTestId('batch-archive'))
  expect(useUiStore.getState().archivedTaskIds).toEqual(['run-a', 'run-b'])
  expect(screen.queryByText('整理收件箱')).not.toBeInTheDocument()

  await userEvent.click(screen.getByTestId('task-archive-toggle'))
  expect(screen.getByText('整理收件箱')).toBeInTheDocument()
  await userEvent.click(screen.getAllByTestId('task-restore')[0])
  expect(useUiStore.getState().archivedTaskIds).toEqual(['run-b'])
})

it('groups tasks by workspace proxy', async () => {
  seed()
  render(<TaskList runs={runs} activeId={null} onSelect={() => {}} />)
  await userEvent.click(screen.getByTestId('task-grouping-toggle'))
  expect(screen.getByTestId('task-group-文件整理')).toBeInTheDocument()
  expect(screen.getByTestId('task-group-数据分析')).toBeInTheDocument()
  expect(screen.getByTestId('task-group-调研写作')).toBeInTheDocument()
})
