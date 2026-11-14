import { defineConfig } from '@playwright/test';
import base from './playwright.browser-bookmarks.config';

export default defineConfig({ ...base,
  testMatch: ['browser-home.pw.ts', 'browser-mobile.pw.ts'],
  outputDir: '../../../.codex-tmp/browser-back-web',
  use: { ...base.use, baseURL: 'http://127.0.0.1:1599/web/', isMobile: true, hasTouch: true },
  webServer: { cwd: '..', command: 'npx vite --config scripts/vite.config.ts --host 127.0.0.1 --port 1599 --strictPort',
    url: 'http://127.0.0.1:1599/web/', timeout: 120_000 },
});
