import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AppFrame } from '@/features/prototype/PrototypePage'
import { useUiStore } from '@/state/ui-state'

beforeEach(() => {
  useUiStore.setState({ module: 'work' })
})

function renderFrame(): void {
  render(<AppFrame workbench={<div data-testid="workbench-stub" />} />)
}

it('switches modules from the prototype nav', async () => {
  renderFrame()
  expect(screen.getByTestId('workbench-stub')).toBeInTheDocument()
  await userEvent.click(screen.getByTestId('module-experts'))
  expect(await screen.findByTestId('experts-page')).toBeInTheDocument()
  await userEvent.click(screen.getByTestId('module-skills'))
  expect(await screen.findByTestId('skills-page')).toBeInTheDocument()
})

it('filters experts and summons one', async () => {
  useUiStore.setState({ module: 'experts' })
  renderFrame()
  await userEvent.type(screen.getByTestId('expert-search'), '数据分析')
  expect(screen.getByText('数据分析师')).toBeInTheDocument()
  expect(screen.queryByText('文件整理管家')).not.toBeInTheDocument()
  await userEvent.click(screen.getByText('数据分析师'))
  await userEvent.click(screen.getByRole('button', { name: '立即召唤' }))
  expect(screen.getByText(/已召唤「数据分析师」/)).toBeInTheDocument()
})

it('installs a skill from the market', async () => {
  useUiStore.setState({ module: 'skills' })
  renderFrame()
  await userEvent.click(screen.getByTestId('skill-tab-market'))
  await userEvent.click(screen.getAllByTestId('skill-install')[0])
  expect(screen.getByTestId('skill-notice')).toHaveTextContent('已安装')
})

it('toggles a connector authorization', async () => {
  useUiStore.setState({ module: 'connectors' })
  renderFrame()
  await userEvent.click(screen.getAllByTestId('connector-toggle')[0])
  expect(screen.getByText(/已断开「腾讯文档」/)).toBeInTheDocument()
})

it('runs and records automation history', async () => {
  useUiStore.setState({ module: 'automation' })
  renderFrame()
  await userEvent.click(screen.getAllByTestId('automation-run')[0])
  expect(screen.getByText(/已触发一次测试运行/)).toBeInTheDocument()
  await userEvent.click(screen.getAllByTestId('automation-history')[0])
  expect(screen.getByTestId('automation-history-list')).toHaveTextContent('刚刚')
})

it('creates an automation from the dialog', async () => {
  useUiStore.setState({ module: 'automation' })
  renderFrame()
  await userEvent.click(screen.getByTestId('automation-create'))
  await userEvent.type(screen.getByTestId('automation-name'), '每日站会摘要')
  await userEvent.click(screen.getByTestId('automation-save'))
  expect(screen.getByText('每日站会摘要')).toBeInTheDocument()
})

it('clears cache and restores an archived task', async () => {
  useUiStore.setState({ module: 'data' })
  renderFrame()
  await userEvent.click(screen.getByTestId('data-clear'))
  expect(screen.getByTestId('data-storage')).toHaveTextContent('0 KB')
  await userEvent.click(screen.getAllByTestId('archive-restore')[0])
  expect(screen.getByText(/已恢复/)).toBeInTheDocument()
})
