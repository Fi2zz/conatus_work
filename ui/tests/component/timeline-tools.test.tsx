import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { TimelineEntry } from '@/bridge/types'
import { Timeline } from '@/features/conversation/Timeline'
import { useUiStore } from '@/state/ui-state'

import { seedRun, toolEntry } from '../helpers/state'

const entries: TimelineEntry[] = [
  { kind: 'user', id: 'u1', at: 0, text: '整理收件箱' },
  { kind: 'assistant', id: 'a1', at: 10, text: '我先看看目录' },
  { kind: 'user', id: 'u2', at: 20, text: '只看 docx 文件' },
]

it('opens the timeline search with cmd+f and filters entries', async () => {
  seedRun([...entries, toolEntry('t1', 'move')])
  render(<Timeline />)
  fireEvent.keyDown(window, { key: 'f', metaKey: true })
  const input = await screen.findByTestId('timeline-search')
  expect(input).toHaveFocus()

  await userEvent.type(input, 'docx')
  expect(screen.getByTestId('timeline-search-count')).toHaveTextContent('1 条')
  expect(screen.getByText('只看 docx 文件')).toBeInTheDocument()
  expect(screen.queryByText('整理收件箱')).not.toBeInTheDocument()
})

it('searches hidden tools even when the key filter would hide them', async () => {
  useUiStore.setState({ filter: 'key' })
  seedRun([{ kind: 'user', id: 'u1', at: 0, text: '开始' }, toolEntry('t1', 'list')])
  render(<Timeline />)
  fireEvent.keyDown(window, { key: 'f', metaKey: true })
  await userEvent.type(await screen.findByTestId('timeline-search'), 'list')
  expect(screen.getByTestId('timeline-search-count')).toHaveTextContent('1 条')
  expect(screen.getByTestId('timeline-entry-tool')).toBeInTheDocument()
})

it('jumps to a previous question from the history menu', async () => {
  seedRun(entries)
  const scroll = vi.fn()
  Element.prototype.scrollIntoView = scroll
  render(<Timeline />)
  await userEvent.click(screen.getByTestId('history-toggle'))
  const items = screen.getAllByTestId('history-item')
  expect(items).toHaveLength(2)
  await userEvent.click(items[1])
  expect(scroll).toHaveBeenCalled()
  expect(screen.queryByTestId('history-menu')).not.toBeInTheDocument()
})

it('copies an entry and shows feedback', async () => {
  seedRun(entries)
  const write = vi.fn(async () => undefined)
  Object.assign(navigator, { clipboard: { writeText: write } })
  render(<Timeline />)
  await userEvent.click(screen.getAllByTestId('copy-entry')[0])
  expect(write).toHaveBeenCalledWith('整理收件箱')
  expect(screen.getAllByTestId('copy-entry')[0]).toHaveTextContent('已复制')
})
