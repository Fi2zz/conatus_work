import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CheckpointPanel } from '@/features/checkpoints/CheckpointPanel'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { Shell } from '@/app/Shell'
import { setTransport } from '@/bridge/transport-store'
import type { BridgeTransport } from '@/bridge/transport'
import { useUiStore } from '@/state/ui-state'

import { seedApproval } from '../helpers/approval'
import { seedChanges, changes } from '../helpers/changes'
import { seedRun } from '../helpers/state'

it('lists turns and greys out pruned ones', () => {
  seedRun([], {
    checkpoints: {
      currentTurn: 5,
      startTurn: 0,
      keep: 2,
      turns: [
        { turn: 1, at: '2026-11-03T10:01:00+08:00', eventCount: 2 },
        { turn: 5, at: '2026-11-03T10:05:00+08:00', eventCount: 9 },
      ],
      gaps: [],
    },
  })
  render(<CheckpointPanel />)
  const pruned = screen.getByTestId('checkpoint-pruned-1')
  expect(pruned).toHaveAttribute('aria-disabled', 'true')
})

it('shows a banner when checkpoint gaps exist', () => {
  seedRun([], {
    checkpoints: {
      currentTurn: 3,
      startTurn: 0,
      keep: 5,
      turns: [
        { turn: 1, at: '2026-11-03T10:01:00+08:00', eventCount: 2 },
        { turn: 3, at: '2026-11-03T10:03:00+08:00', eventCount: 9 },
      ],
      gaps: [2],
    },
  })
  render(<CheckpointPanel />)
  expect(screen.getByTestId('checkpoint-gap-banner')).toHaveTextContent('空洞')
})

it('disables the composer while approval is pending', () => {
  seedApproval()
  render(<Shell />)
  expect(screen.getByPlaceholderText('等待审批…')).toBeDisabled()
  expect(screen.queryByTestId('composer-send')).not.toBeInTheDocument()
})

it('records the deny decision in the timeline', async () => {
  seedApproval()
  render(<Shell />)
  await userEvent.click(screen.getByRole('button', { name: '拒绝' }))
  expect(await screen.findByTestId('timeline-entry-approval')).toHaveTextContent('已拒绝')
})

it('opens the command palette with cmd+k', async () => {
  seedApproval()
  render(<Shell />)
  fireEvent.keyDown(window, { key: 'k', metaKey: true })
  expect(await screen.findByTestId('command-palette')).toBeInTheDocument()
})

it('opens the undo dialog with cmd+z instead of undoing directly', async () => {
  let undoCalls = 0
  seedChanges(changes())
  setTransport({
    async undo() {
      undoCalls += 1
      return { ok: true, value: { ok: true, appliedSteps: 1, failures: [] } }
    },
  } as unknown as BridgeTransport)
  render(<Shell />)
  fireEvent.keyDown(window, { key: 'z', metaKey: true })
  expect(useUiStore.getState().undoDialog).toBe(true)
  expect(undoCalls).toBe(0)
})

it('saves model config through the host', async () => {
  const saved: Array<Record<string, unknown>> = []
  seedRun([], { model: 'opencode-go/deepseek-v4.1-flash' })
  setTransport({
    async readConfig() {
      return { ok: true, value: { configured: true, baseUrl: '', model: '', hasKey: false } }
    },
    async saveConfig(payload: Record<string, unknown>) {
      saved.push(payload)
      return { ok: true, value: { configured: true, ...payload } }
    },
  } as unknown as BridgeTransport)

  render(<SettingsPage />)
  await screen.findByText('已配置')
  await userEvent.type(screen.getByTestId('settings-base-url'), 'https://x/v1')
  await userEvent.type(screen.getByTestId('settings-model'), 'm1')
  await userEvent.click(screen.getByTestId('settings-save'))

  await screen.findByText('已保存')
  expect(saved[0]).toMatchObject({ baseUrl: 'https://x/v1', model: 'm1' })
})

it('explains a failed approval submission and keeps the bar open', async () => {
  seedApproval()
  setTransport({
    async respondApproval() {
      return { ok: false, error: { code: 'DENIED', message: '审批已过期' } }
    },
  } as unknown as BridgeTransport)
  render(<Shell />)
  await userEvent.click(screen.getByRole('button', { name: '拒绝' }))
  expect(await screen.findByTestId('approval-error')).toHaveTextContent('审批已过期')
  expect(screen.getByTestId('approval-bar')).toBeInTheDocument()
})

it('explains that a finished replay will not execute new messages', () => {
  seedRun([], { status: 'succeeded' })
  setTransport({ mode: 'replay' } as unknown as BridgeTransport)
  render(<Shell />)
  expect(screen.getByTestId('composer-ended')).toHaveTextContent('回放已结束')
})
