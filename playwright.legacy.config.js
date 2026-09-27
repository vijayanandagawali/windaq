/**
 * LEGACY Playwright configuration — run with: npm run test:e2e:legacy
 */
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  // Legacy suite (pre-audit): many specs target live URLs or sandbox headers. The maintained
  // suite lives in tests/e2e and runs via playwright.config.js.
  testIgnore: ['e2e/**'],
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
