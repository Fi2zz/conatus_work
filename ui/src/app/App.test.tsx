import { render, screen } from '@testing-library/react'

import App from './App'

it('renders the workbench shell', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Conatus Work' })).toBeInTheDocument()
})
