import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: 'chrome',
    trace: 'retain-on-failure',
    headless: true,
  },
  webServer: [
    {
      command: 'node apps/server/dist/index.js',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: false,
      env: {
        PORT: '3001',
        HOST: '127.0.0.1',
        STATEGHOST_TEST_PROVIDER: '1',
        NODE_ENV: 'test',
        DATA_DIR: './data-test',
      },
      timeout: 15000,
    },
    {
      command: 'npm run dev -w @stateghost/web',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      timeout: 15000,
    },
  ],
});
