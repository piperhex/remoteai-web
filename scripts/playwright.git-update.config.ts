import { defineConfig } from '@playwright/test';
import { testBrowserLaunchOptions } from '../../../scripts/test-browser.mjs';

export default defineConfig({
  testDir: '../e2e', testMatch: ['git-update.pw.ts'], workers: 1, timeout: 60_000,
  outputDir: '../../../.codex-tmp/git-update-web',
  use: { baseURL: 'http://127.0.0.1:1585/web/', launchOptions: testBrowserLaunchOptions(), locale: 'zh-CN' },
  webServer: { cwd: '..', command: 'npx vite --config scripts/vite.config.ts --host 127.0.0.1 --port 1585',
    url: 'http://127.0.0.1:1585/web/', reuseExistingServer: false },
});
