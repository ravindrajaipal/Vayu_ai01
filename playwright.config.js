// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.spec.js',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'python3 -m http.server 4173',
        url: 'http://127.0.0.1:4173/index.html',
        reuseExistingServer: !process.env.CI,
        timeout: 15_000,
      },
  projects: [
    {
      name: 'Desktop Chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'Mobile Chrome (Android)',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
