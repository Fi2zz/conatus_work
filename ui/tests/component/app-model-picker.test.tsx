import { render, screen } from '@testing-library/react'

import App from '@/app/App'

import { createStubTransport, summaryOf } from '../helpers/transport'

it('shows the model picker after the transport is installed', async () => {
  const transport = createStubTransport([summaryOf()])
  transport.readConfig = async () => ({
    ok: true,
    value: {
      configured: true,
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-flash',
      providerName: 'deepseek',
      hasKey: true,
    },
  })
  render(<App transport={transport} />)
  expect(await screen.findByTestId('model-picker-trigger', {}, { timeout: 2000 })).toBeInTheDocument()
})
