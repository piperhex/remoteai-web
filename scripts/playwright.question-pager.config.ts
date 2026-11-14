import { defineConfig } from '@playwright/test';
import { testBrowserLaunchOptions } from '../../../scripts/test-browser.mjs';

export default defineConfig({
  testDir: '../e2e', testMatch: 'question-pager.pw.ts', workers: 1, timeout: 45_000,
  outputDir: '../../../.codex-tmp/question-pager-web', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:1584/web/', locale: 'zh-CN', headless: true,
    permissions: ['microphone'], screenshot: 'only-on-failure', trace: 'retain-on-failure',
    launchOptions: testBrowserLaunchOptions({
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    }) },
  webServer: { cwd: '..',
    command: 'npx vite --config scripts/vite.config.ts --host 127.0.0.1 --port 1584 --strictPort',
    url: 'http://127.0.0.1:1584/web/e2e/question-pager-harness.html', reuseExistingServer: false },
});
