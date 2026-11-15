import { testBrowserLaunchOptions } from '../../../scripts/test-browser.mjs';
import { defineConfig } from '@playwright/test';

const fixtureUrl = 'http://127.0.0.1:1498';
export default defineConfig({
  testDir: '../e2e', testMatch: 'agent-hub.pw.ts', workers: 1, timeout: 180_000,
  outputDir: '../../../.codex-tmp/agent-hub-web-playwright', reporter: 'list',
  use: { launchOptions: testBrowserLaunchOptions(), baseURL: 'http://127.0.0.1:1497/web/',
    locale: 'zh-CN', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'node e2e/mobile-fixture.mjs', cwd: '../../desktop', url: `${fixtureUrl}/test/state`,
      env: { CHAT_TEST_API_PORT: '1498', CHAT_TEST_UI_PORT: '1518' }, reuseExistingServer: false },
    { cwd: '..', command: 'npx vite --config scripts/vite.config.ts --host 127.0.0.1 --port 1497 --strictPort',
      url: 'http://127.0.0.1:1497/web/', env: { VITE_DEV_API_URL: fixtureUrl }, reuseExistingServer: false },
  ],
});
