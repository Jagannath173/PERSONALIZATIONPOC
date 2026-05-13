import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './regression',
  fullyParallel: false,         // run sequentially — tests share backend state
  retries: 1,
  timeout: 60_000,              // LLM calls can be slow
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /* Start both servers before running tests */
  webServer: [
    {
      command: 'cd ../backend && python main.py',
      url: 'http://localhost:8000/health',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'cd ../frontend && npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
})
