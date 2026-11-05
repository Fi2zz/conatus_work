import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { BridgeTransport } from '@/bridge/transport'
import { setTransport } from '@/bridge/transport-store'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { useUiStore } from '@/state/ui-state'

import { seedRun } from '../helpers/state'

function transportWith(handlers: Partial<BridgeTransport>): void {
  const base = {
    async readConfig() {
      return { ok: true as const, value: { configured: false } }
    },
    async saveConfig() {
      return { ok: true as const, value: { configured: true } }
    },
    ...handlers,
  }
  setTransport(base as unknown as BridgeTransport)
}

beforeEach(() => {
  globalThis.localStorage?.clear()
  delete document.documentElement.dataset.theme
  useUiStore.setState({ theme: 'auto' })
  seedRun([], { checkpoints: { currentTurn: 2, startTurn: 0, keep: 7, turns: [], gaps: [] } })
})

it('switches settings sections and keeps the checkpoint value', async () => {
  transportWith({})
  render(<SettingsPage />)
  await userEvent.click(screen.getByTestId('settings-nav-data'))
  expect(screen.getByTestId('settings-keep')).toHaveTextContent('7')
})

it('persists the selected theme', async () => {
  transportWith({})
  render(<SettingsPage />)
  await userEvent.click(screen.getByTestId('settings-nav-general'))
  await userEvent.click(screen.getByTestId('theme-dark'))
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(useUiStore.getState().theme).toBe('dark')
})

it('chooses a default workspace through the host', async () => {
  transportWith({ async chooseWorkspace() { return { ok: true, value: { path: '/tmp/workspace' } } } })
  render(<SettingsPage />)
  await userEvent.click(screen.getByTestId('settings-nav-general'))
  await userEvent.click(screen.getByTestId('settings-choose-workspace'))
  expect(await screen.findByTestId('settings-workspace')).toHaveTextContent('/tmp/workspace')
  expect(globalThis.localStorage?.getItem('conatus.defaultWorkspace')).toBe('/tmp/workspace')
})

it('shows version and copies diagnostics', async () => {
  const write = vi.fn(async () => undefined)
  Object.assign(navigator, { clipboard: { writeText: write } })
  transportWith({})
  render(<SettingsPage />)
  await userEvent.click(screen.getByTestId('settings-nav-about'))
  expect(screen.getByTestId('settings-version')).toHaveTextContent('0.1.0')
  await userEvent.click(screen.getByTestId('settings-copy-diag'))
  expect(write).toHaveBeenCalled()
})

it('offers multiple providers and fills the model preset', async () => {
  transportWith({})
  render(<SettingsPage />)
  const provider = screen.getByTestId('settings-provider') as HTMLSelectElement
  expect(provider.options.length).toBeGreaterThan(5)
  await userEvent.selectOptions(provider, 'openai')
  await userEvent.selectOptions(screen.getByTestId('settings-model-select'), 'gpt-5.5')
  expect(screen.getByTestId('settings-base-url')).toHaveValue('https://api.openai.com/v1')
  expect(screen.getByTestId('settings-model')).toHaveValue('gpt-5.5')
  expect(screen.getByTestId('settings-price-in')).toHaveValue('5')
})

it('lists current Kimi models instead of only K2', async () => {
  transportWith({})
  render(<SettingsPage />)
  await userEvent.selectOptions(screen.getByTestId('settings-provider'), 'moonshot')
  const model = screen.getByTestId('settings-model-select') as HTMLSelectElement
  const labels = [...model.options].map((option) => option.textContent)
  expect(labels).toContain('Kimi K3.1 Pro')
  expect(labels).toContain('Kimi K3')
  await userEvent.selectOptions(model, 'kimi-k3.1-pro')
  expect(screen.getByTestId('settings-model')).toHaveValue('kimi-k3.1-pro')
})
