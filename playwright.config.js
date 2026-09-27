/**
 * Maintained end-to-end suite (tests/e2e).
 *
 * Boots the real realtime backend and the Next.js app against a disposable local test database
 * (DATABASE_URL_TEST — see "npm run db:local"). The backend launcher resets that database first.
 *
 *   DATABASE_URL_TEST=postgresql://... npm run test:e2e
 */
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const { E2E } = require('./tests/e2e/support/constants');

const isCI = Boolean(process.env.CI);

const backendEnv = {
  DATABASE_URL_TEST: process.env.DATABASE_URL_TEST || '',
  NODE_ENV: 'development',
  PORT: String(E2E.backendPort),
  JWT_SECRET: E2E.jwtSecret,
  DEV_FIXED_OTP: E2E.otp,
  FAST2SMS_API_KEY: '',
  WINDAQ_TEST_HARNESS: '1',
  FRONTEND_URL: E2E.webUrl
};

const webEnv = {
  NEXT_PUBLIC_API_URL: E2E.backendUrl,
  NEXT_PUBLIC_WS_URL: E2E.backendUrl,
  REALTIME_URL: E2E.backendUrl,
  NEXT_PUBLIC_MERCHANT_UPI_ID: E2E.merchantUpi
};

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.js',
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: E2E.webUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }
  ],
  webServer: [
    {
      command: 'node tests/e2e/support/start-backend.js',
      url: `${E2E.backendUrl}/api/catalog`,
      env: backendEnv,
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe'
    },
    {
      // Always a production build: dev-only overlays (e.g. the Next.js dev indicator) cover controls.
      command: `npm run build --workspace=frontend && npm run start --workspace=frontend -- -p ${E2E.webPort}`,
      cwd: path.resolve(__dirname),
      url: E2E.webUrl,
      env: webEnv,
      timeout: 300_000,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe'
    }
  ]
});
