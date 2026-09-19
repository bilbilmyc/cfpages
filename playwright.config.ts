import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8788',
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: 'list',
});
