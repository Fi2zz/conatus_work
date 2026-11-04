import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Shell } from '@/app/Shell'

import { seedRun } from '../helpers/state'

const plan = [
  { id: 'p1', title: '读取收件箱', status: 'done' as const },
  { id: 'p2', title: '按类型和月份移动', status: 'doing' as const },
  { id: 'p3', title: '写出变更清单', status: 'todo' as const },
]

it('renders the plan with progress and current step', () => {
  seedRun([], { plan })
  render(<Shell />)
  const strip = screen.getByTestId('plan-strip')
  expect(strip).toHaveTextContent('1/3')
  expect(strip).toHaveTextContent('按类型和月份移动')
  expect(screen.getAllByTestId('plan-item')).toHaveLength(3)
  expect(screen.getAllByTestId('plan-item')[0]).toHaveAttribute('data-status', 'done')
})

it('collapses the plan to a single progress line', async () => {
  seedRun([], { plan })
  render(<Shell />)
  await userEvent.click(screen.getByTestId('plan-toggle'))
  expect(screen.queryByTestId('plan-items')).not.toBeInTheDocument()
  expect(screen.getByTestId('plan-strip')).toHaveTextContent('1/3')
})

it('marks a failed step in red and keeps it as the current line', () => {
  seedRun([], {
    plan: [
      { id: 'p1', title: '读取', status: 'done' },
      { id: 'p2', title: '写入 out/', status: 'failed' },
      { id: 'p3', title: '收尾', status: 'todo' },
    ],
  })
  render(<Shell />)
  expect(screen.getAllByTestId('plan-item')[1]).toHaveTextContent('写入 out/')
  expect(screen.getByTestId('plan-strip')).toHaveTextContent('写入 out/')
})
