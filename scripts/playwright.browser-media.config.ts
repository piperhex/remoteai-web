import { defineConfig } from '@playwright/test';
import { testBrowserLaunchOptions } from '../../../scripts/test-browser.mjs';

export default defineConfig({
  testDir: '../e2e', testMatch: ['browser-media.pw.ts', 'browser-geolocation.pw.ts'], workers: 1, timeout: 60_000,
  outputDir: '../../../.codex-tmp/browser-media-web',
  use: { baseURL: 'http://127.0.0.1:1593/web/', isMobile: true, hasTouch: true, locale: 'zh-CN',
    launchOptions: testBrowserLaunchOptions({ channel: 'chromium', args: ['--use-fake-device-for-media-stream'] }) },
  webServer: { cwd: '..', command: 'npx vite --config scripts/vite.config.ts --host 127.0.0.1 --port 1593 --strictPort',
    url: 'http://127.0.0.1:1593/web/', timeout: 120_000 },
});
