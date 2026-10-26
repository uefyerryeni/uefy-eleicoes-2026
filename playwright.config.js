const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 45000,
  expect: { timeout: 8000 },
  retries: 1,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    launchOptions: process.env.UEFY_BROWSER_PATH ? {executablePath:process.env.UEFY_BROWSER_PATH} : {},
    headless: true,
    acceptDownloads: true,
  },
  webServer: {
    command: (process.env.UEFY_PYTHON || 'python3') + ' -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
