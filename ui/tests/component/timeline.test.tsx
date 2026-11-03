import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { TimelineEntry } from '@/bridge/types'
import { Timeline } from '@/features/conversation/Timeline'
import { useUiStore } from '@/state/ui-state'

import { seedRun, toolEntry } from '../helpers/state'

const userEntry: TimelineEntry = { kind: 'user', id: 'u1', at: 0, text: '整理收件箱' }
const assistantEntry: TimelineEntry = {
  kind: 'assistant',
  id: 'a1',
  at: 10,
  text: '我先查看目录',
  reasoning: '需要先列目录',
}

it('renders a user entry and an assistant entry', () => {
  seedRun([userEntry, assistantEntry])
  render(<Timeline />)
  expect(screen.getByTestId('timeline-entry-user')).toHaveTextContent('整理收件箱')
  expect(screen.getByTestId('timeline-entry-assistant')).toHaveTextContent('我先查看目录')
})

it('groups consecutive moves into "move ×11"', () => {
  const moves = Array.from({ length: 11 }, (_, index) => toolEntry(`m${index}`, 'move'))
  seedRun(moves)
  render(<Timeline />)
  expect(screen.getByTestId('tool-group')).toHaveTextContent('move ×11')
})

it('expands a tool group on click', async () => {
  const moves = Array.from({ length: 11 }, (_, index) => toolEntry(`m${index}`, 'move'))
  seedRun(moves)
  render(<Timeline />)
  await userEvent.click(screen.getByTestId('tool-group'))
  expect(screen.getAllByTestId('timeline-entry-tool')).toHaveLength(11)
})

it('key filter hides successful reads but keeps failures', async () => {
  seedRun([toolEntry('r1', 'read'), toolEntry('r2', 'write'), toolEntry('r3', 'read', false)])
  render(<Timeline />)
  await userEvent.click(screen.getByRole('button', { name: '关键' }))
  expect(screen.getByText('read')).toBeInTheDocument()
  const tools = screen.getAllByTestId('timeline-entry-tool')
  expect(tools).toHaveLength(2)
})

it('collapses reasoning by default and expands on click', async () => {
  seedRun([assistantEntry])
  render(<Timeline />)
  expect(screen.queryByText('需要先列目录')).not.toBeInTheDocument()
  await userEvent.click(screen.getByTestId('reasoning-toggle'))
  expect(screen.getByText('需要先列目录')).toBeInTheDocument()
})

it('shows an unknown-events badge when the counter is non-zero', () => {
  seedRun([userEntry])
  useUiStore.setState({ filter: 'all' })
  render(<Timeline unknownEvents={2} />)
  expect(screen.getByTestId('unknown-events-badge')).toHaveTextContent('2')
})
