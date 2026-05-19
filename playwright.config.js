const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'tests/playwright-report' }]],
  use: {
    baseURL: 'http://localhost:5501',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    // Capture screenshot on failure
    screenshot: 'only-on-failure',
    video: 'off'
  },
  // Start server before tests
  webServer: {
    command: 'node server.js',
    url: 'http://localhost:5501/html/login.html',
    reuseExistingServer: true,
    timeout: 15_000
  }
});
