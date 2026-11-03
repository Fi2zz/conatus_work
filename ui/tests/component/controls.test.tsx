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
