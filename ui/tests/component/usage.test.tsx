import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Shell } from '@/app/Shell'
import { TaskList } from '@/features/tasks/TaskList'
import { useUiStore } from '@/state/ui-state'

import { seedRun } from '../helpers/state'

it('summarizes usage and cost by run chain', async () => {
  const run = seedRun([], { chain: 'organize', usage: { inputTokens: 1200, outputTokens: 340, costUsd: 0.0123 } })
  useUiStore.setState({ usageOpen: false })
  render(<Shell />)
  await userEvent.click(screen.getByTestId('usage-button'))
  const dialog = screen.getByTestId('usage-dialog')
  expect(dialog).toHaveTextContent('1')
  expect(dialog).toHaveTextContent('1,200')
  expect(screen.getByTestId('usage-cost')).toHaveTextContent('$0.0123')
  expect(screen.getByTestId('usage-chains')).toHaveTextContent(run.chain)
})

it('opens the shortcut sheet with the question mark key', async () => {
  seedRun([])
  render(<Shell />)
  fireEvent.keyDown(window, { key: '?' })
  expect(await screen.findByTestId('shortcuts-list')).toHaveTextContent('⌘K')
  fireEvent.keyDown(window, { key: 'Escape' })
})

it('shows a getting-started card when there are no tasks', async () => {
  render(<TaskList runs={[]} activeId={null} onSelect={() => {}} />)
  expect(screen.getByTestId('task-list-empty')).toHaveTextContent('开始第一个任务')
  await userEvent.click(screen.getByRole('button', { name: '快捷键' }))
  expect(useUiStore.getState().shortcutsOpen).toBe(true)
})
