import { defineConfig } from '@playwright/test';
import { testBrowserLaunchOptions } from '../../../scripts/test-browser.mjs';

export default defineConfig({
  testDir: '../e2e', testMatch: 'mobile-image-navigation.pw.ts', workers: 1, timeout: 45_000,
  outputDir: '../../../.codex-tmp/mobile-image-navigation', reporter: [['list']],
  use: { launchOptions: testBrowserLaunchOptions(), baseURL: 'http://127.0.0.1:1597/web/',
    locale: 'zh-CN', headless: true, hasTouch: true, isMobile: true, screenshot: 'only-on-failure' },
  webServer: { cwd: '..',
    command: 'npx vite --config scripts/vite.config.ts --host 127.0.0.1 --port 1597 --strictPort',
    url: 'http://127.0.0.1:1597/web/', reuseExistingServer: false },
});
