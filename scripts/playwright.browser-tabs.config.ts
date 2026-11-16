import { defineConfig } from '@playwright/test';
import { testBrowserLaunchOptions } from '../../../scripts/test-browser.mjs';

export default defineConfig({
  testDir: '../e2e', testMatch: ['browser-tabs.pw.ts', 'browser-chrome.pw.ts',
    'browser-loading.pw.ts', 'workspace-start.pw.ts', 'workspace-tab-menu.pw.ts', 'workspace-add-tab.pw.ts'],
  workers: 1, timeout: 60_000,
  outputDir: '../../../.codex-tmp/browser-tabs-web',
  use: { baseURL: 'http://127.0.0.1:1567/web/', launchOptions: testBrowserLaunchOptions(),
    viewport: { width: 1440, height: 900 }, locale: 'zh-CN' },
  webServer: { cwd: '..', command: 'npx vite --config scripts/vite.config.ts --host 127.0.0.1 --port 1567 --strictPort',
    url: 'http://127.0.0.1:1567/web/', timeout: 120_000 },
});
