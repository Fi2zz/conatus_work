import { render, screen } from '@testing-library/react'

import App from './App'

it('loads the default fixture and renders the workbench shell', async () => {
  window.history.replaceState({}, '', '/')
  render(<App />)
  expect(await screen.findByTestId('task-list')).toBeInTheDocument()
  expect(screen.getByTestId('run-title')).toHaveTextContent(/整理收件箱|任务/)
})
