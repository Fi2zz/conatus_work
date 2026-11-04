import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Shell } from '@/app/Shell'
import type { BridgeTransport } from '@/bridge/transport'
import { setTransport } from '@/bridge/transport-store'
import { useUiStore } from '@/state/ui-state'
import { useWorkbenchStore } from '@/state/workbench-store'

import { seedRun } from '../helpers/state'

function transportWith(handlers: Partial<BridgeTransport>): void {
  setTransport(handlers as unknown as BridgeTransport)
}

it('stops a running task', async () => {
  seedRun([], { status: 'running' })
  transportWith({
    async cancelTask(runId) {
      useWorkbenchStore.getState().apply({
        seq: 900,
        at: 100,
        type: 'task/status',
        runId,
        data: { status: 'aborted' },
      })
      return { ok: true, value: { status: 'aborted' } }
    },
  })
  render(<Shell />)
  await userEvent.click(screen.getByTestId('stop-button'))
  expect(screen.getByTestId('run-header')).toHaveTextContent('aborted')
})

it('exposes an explicit stop button while running', async () => {
  seedRun([], { status: 'running' })
  const cancelled: string[] = []
  transportWith({
    async cancelTask(runId: string) {
      cancelled.push(runId)
      return { ok: true, value: { status: 'aborted' } }
    },
  })
  render(<Shell />)
  const button = screen.getByTestId('stop-button')
  expect(button).toHaveTextContent('停止')
  await userEvent.click(button)
  expect(cancelled).toEqual(['run-a'])
  // 点击后立即进入「停止中」，直到运行结束
  expect(button).toHaveTextContent('停止中')
  expect(button).toBeDisabled()
})

it('stops the running task with cmd+period', async () => {
  seedRun([], { status: 'running' })
  const cancelled: string[] = []
  transportWith({
    async cancelTask(runId: string) {
      cancelled.push(runId)
      return { ok: true, value: { status: 'aborted' } }
    },
  })
  render(<Shell />)
  fireEvent.keyDown(window, { key: '.', metaKey: true })
  expect(cancelled).toEqual(['run-a'])
})

it('retries a failed task as a new run', async () => {
  seedRun([], { status: 'failed' })
  transportWith({
    async startTask() {
      useWorkbenchStore.getState().apply({
        seq: 0,
        at: 0,
        type: 'task/started',
        runId: 'run-a#1',
        data: {
          taskId: 'task-a',
          title: '任务 A（重试）',
          chain: 'organize',
          model: 'test/model',
          startedAt: '2026-11-03T12:00:00+08:00',
        },
      })
      return { ok: true, value: { runId: 'run-a#1' } }
    },
  })
  render(<Shell />)
  await userEvent.click(screen.getByTestId('retry-button'))
  expect(useWorkbenchStore.getState().activeRunId).toBe('run-a#1')
  expect(useWorkbenchStore.getState().order).toHaveLength(2)
})

it('collapses the left rail', async () => {
  seedRun([])
  render(<Shell />)
  await userEvent.click(screen.getByTestId('left-toggle'))
  expect(screen.queryByTestId('task-list')).not.toBeInTheDocument()
  expect(screen.getByTestId('left-rail')).toBeInTheDocument()
  expect(screen.getByTestId('shell').style.gridTemplateColumns).toContain('56px')
})

it('drags the right pane width within bounds', () => {
  seedRun([])
  render(<Shell />)
  const splitter = screen.getByTestId('right-splitter')
  fireEvent.pointerDown(splitter, { clientX: 800, pointerId: 1 })
  fireEvent.pointerMove(splitter, { clientX: 200, pointerId: 1 })
  expect(useUiStore.getState().rightWidth).toBe(560)
  fireEvent.pointerMove(splitter, { clientX: 1000, pointerId: 1 })
  expect(useUiStore.getState().rightWidth).toBe(320)
  fireEvent.pointerUp(splitter, { clientX: 1000, pointerId: 1 })
})

it('resets the right pane width on double click', async () => {
  seedRun([])
  useUiStore.setState({ rightWidth: 500 })
  render(<Shell />)
  await userEvent.dblClick(screen.getByTestId('right-splitter'))
  expect(useUiStore.getState().rightWidth).toBe(380)
})

it('offers a stop button next to the composer while running', async () => {
  seedRun([], { status: 'running' })
  const cancelled: string[] = []
  transportWith({
    async cancelTask(runId: string) {
      cancelled.push(runId)
      return { ok: true, value: { status: 'aborted' } }
    },
  })
  render(<Shell />)
  await userEvent.click(screen.getByTestId('composer-stop'))
  expect(cancelled).toEqual(['run-a'])
})

it('clears the draft after a successful send', async () => {
  seedRun([], { status: 'succeeded' })
  const sent: Array<[string, string]> = []
  transportWith({
    mode: 'host',
    async sendMessage(runId: string, text: string) {
      sent.push([runId, text])
      return { ok: true, value: undefined }
    },
  })
  useUiStore.setState({ composerDraft: '继续整理剩下的一半' })
  render(<Shell />)
  await userEvent.click(screen.getByTestId('composer-send'))
  expect(sent).toEqual([['run-a', '继续整理剩下的一半']])
  expect(useUiStore.getState().composerDraft).toBe('')
})

it('keeps the draft and explains a failed send', async () => {
  seedRun([], { status: 'succeeded' })
  transportWith({
    mode: 'host',
    async sendMessage() {
      return { ok: false, error: { code: 'INTERNAL', message: '宿主还没接上 message.send' } }
    },
  })
  useUiStore.setState({ composerDraft: '别丢了我' })
  render(<Shell />)
  await userEvent.click(screen.getByTestId('composer-send'))
  expect(await screen.findByTestId('composer-error')).toHaveTextContent('宿主还没接上')
  expect(useUiStore.getState().composerDraft).toBe('别丢了我')
})

it('only offers stop while a host run is executing', () => {
  seedRun([], { status: 'running' })
  transportWith({ mode: 'host' })
  render(<Shell />)
  expect(screen.getByTestId('composer-stop')).toBeInTheDocument()
  expect(screen.queryByTestId('composer-send')).not.toBeInTheDocument()
  expect(screen.getByPlaceholderText('运行中，停止后可继续交代')).toBeInTheDocument()
})

it('lets a finished host run continue with a follow-up message', () => {
  seedRun([], { status: 'succeeded' })
  transportWith({ mode: 'host' })
  render(<Shell />)
  expect(screen.getByTestId('composer-send')).toBeInTheDocument()
  expect(screen.getByTestId('composer-continue')).toHaveTextContent('继续该会话')
})

it('disables sending in replay mode and says why', () => {
  seedRun([], { status: 'running' })
  transportWith({ mode: 'replay' })
  render(<Shell />)
  expect(screen.getByTestId('composer-ended')).toHaveTextContent('回放模式')
  expect(screen.queryByTestId('composer-send')).not.toBeInTheDocument()
})

it('expands the result pane and exits with escape', async () => {
  seedRun([])
  render(<Shell />)
  const pane = screen.getByTestId('right-pane')
  expect(pane).toHaveAttribute('data-expanded', 'false')
  await userEvent.click(screen.getByTestId('right-expand'))
  expect(pane).toHaveAttribute('data-expanded', 'true')
  expect(screen.getByTestId('right-exit-floating')).toBeInTheDocument()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(pane).toHaveAttribute('data-expanded', 'false')
})

it('auto-collapses the task list in a narrow window', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'innerWidth')
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 820 })
  seedRun([])
  render(<Shell />)
  expect(screen.getByTestId('left-rail')).toBeInTheDocument()
  expect(screen.queryByTestId('task-list')).not.toBeInTheDocument()
  expect(screen.getByTestId('left-toggle')).toBeDisabled()
  if (original) Object.defineProperty(window, 'innerWidth', original)
})

it('adds and removes a mock attachment', async () => {
  seedRun([], { status: 'succeeded' })
  transportWith({ mode: 'host' })
  render(<Shell />)
  await userEvent.click(screen.getByTestId('composer-attach'))
  await userEvent.click(screen.getAllByTestId('composer-option')[0])
  expect(screen.getByTestId('composer-attachment')).toHaveTextContent('会议纪要.docx')
  await userEvent.click(screen.getByTestId('remove-attachment'))
  expect(screen.queryByTestId('composer-attachment')).not.toBeInTheDocument()
})

it('inserts a context reference from the toolbar', async () => {
  seedRun([], { status: 'succeeded' })
  transportWith({ mode: 'host' })
  render(<Shell />)
  await userEvent.click(screen.getByTestId('composer-mention'))
  await userEvent.click(screen.getAllByTestId('composer-option')[0])
  expect(useUiStore.getState().composerDraft).toContain('@当前工作区')
})
