// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Cap CI workers so desktop+mobile projects don't contend on the runner's
  // cores and cause timing-based flakiness (was the secondary CI-only failure).
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8242',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'python3 -m http.server 8242',
    url: 'http://localhost:8242',
    reuseExistingServer: !process.env.CI,
    timeout: 15000
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } }
  ]
});
