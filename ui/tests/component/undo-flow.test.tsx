import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Shell } from '@/app/Shell'
import type { BridgeTransport } from '@/bridge/transport'
import { setTransport } from '@/bridge/transport-store'
import { TaskList } from '@/features/tasks/TaskList'
import { undoScope } from '@/state/selectors'
import { useUiStore } from '@/state/ui-state'
import { useWorkbenchStore } from '@/state/workbench-store'

import { changes, seedChanges } from '../helpers/changes'
import { seedRun } from '../helpers/state'
import { summaryOf } from '../helpers/transport'

it('does not allow a second undo after a successful one', async () => {
  seedChanges(changes())
  render(<Shell />)
  await userEvent.click(screen.getByTestId('undo-button'))
  await userEvent.click(await screen.findByRole('button', { name: '确认撤销' }))
  await screen.findByTestId('undo-notice')

  fireEvent.keyDown(window, { key: 'z', metaKey: true })
  expect(await screen.findByTestId('undo-blocked')).toHaveTextContent('没有可撤销的轮次')
  expect(screen.queryByRole('button', { name: '确认撤销' })).not.toBeInTheDocument()
})

it('opens the undo dialog with cmd+z from any tab', async () => {
  seedChanges(changes())
  useUiStore.setState({ rightTab: 'artifacts' })
  render(<Shell />)
  fireEvent.keyDown(window, { key: 'z', metaKey: true })
  expect(await screen.findByTestId('undo-dialog')).toBeInTheDocument()
})

it('shows how far the run was rolled back', async () => {
  seedChanges(changes())
  render(<Shell />)
  await userEvent.click(screen.getByTestId('undo-button'))
  await userEvent.click(await screen.findByRole('button', { name: '确认撤销' }))
  expect(await screen.findByTestId('undo-notice')).toHaveTextContent('已撤销到轮次 0')
})

it('surfaces a command-level failure instead of swallowing it', async () => {
  seedChanges(changes())
  setTransport({
    async undo() {
      return { ok: false, error: { code: 'PRUNED', message: '轮次 0 已被裁剪' } }
    },
  } as unknown as BridgeTransport)

  render(<Shell />)
  await userEvent.click(screen.getByTestId('undo-button'))
  await userEvent.click(await screen.findByRole('button', { name: '确认撤销' }))
  expect(await screen.findByTestId('command-error')).toHaveTextContent('保留范围')
})

it('counts undo steps in the left rail, not recorded turns', () => {
  seedRun([], {
    checkpoints: {
      currentTurn: 3,
      startTurn: 0,
      keep: 5,
      turns: [
        { turn: 1, at: '2026-11-03T10:01:00+08:00', eventCount: 2 },
        { turn: 3, at: '2026-11-03T10:03:00+08:00', eventCount: 6 },
      ],
      gaps: [2],
    },
  })
  const run = useWorkbenchStore.getState().runs['run-a']
  expect(undoScope(run).steps).toBe(3)
  render(<Shell />)
  expect(screen.getByTestId('undo-scope-label')).toHaveTextContent('可撤销 3 轮')
})

it('marks synthetic fixtures in the run header', () => {
  seedRun([], { synthetic: true })
  render(<Shell />)
  expect(screen.getByTestId('run-header')).toHaveTextContent('合成数据')
})

it('groups the newest day under 今天', () => {
  render(<TaskList runs={[summaryOf()]} activeId="run-a" onSelect={() => {}} />)
  expect(screen.getByTestId('task-group-今天')).toBeInTheDocument()
})
