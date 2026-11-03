import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm run preview -- --port 4173',
    port: 4173,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
