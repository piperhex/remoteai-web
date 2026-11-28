import { expect, test } from '@playwright/test';
import type { desktopTest } from './remote-desktop-fixture';
import { checkDesktopTabs, computers, connectCaptureHosts } from './remote-desktop-tab-checks';
import { testBrowserLaunchOptions } from '../../../scripts/test-browser.mjs';

test.use({ launchOptions: testBrowserLaunchOptions({ args: ['--enable-caret-browsing'] }) });

declare global { interface Window { desktopTest: typeof desktopTest } }

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.addInitScript(() => {
    localStorage.setItem('codex-switch.web.session.v1', JSON.stringify({ baseUrl: location.origin,
      email: 'viewer@example.test', accessToken: 'fixture', refreshToken: 'fixture' }));
  });
  await page.route('**/auth/me', route => route.fulfill({ json: { id: 'viewer', email: 'viewer@example.test' } }));
  await page.route('**/devices', route => route.fulfill({ json: { devices: computers } }));
  await page.route('**/devices/providers?*', route => route.fulfill({ json: { providers: [] } }));
  await page.route('**/sync/accounts/web-summary', route => route.fulfill({ json: { accounts: [] } }));
  await page.routeWebSocket('**/device-switch', socket => socket.onMessage(() =>
    socket.send(JSON.stringify({ type: 'devices-snapshot', devices: computers }))));
});

test('standalone desktop retains independent computer tabs at the background frame rate', async ({ page }, info) => {
  const hosts = await connectCaptureHosts(page, '/web/e2e/remote-desktop-fixture.ts', 'webChatConnection');
  await page.goto('./');
  await page.locator('.desktop-sidebar nav').getByRole('button', { name: '远程桌面', exact: true }).click();
  await checkDesktopTabs(page, hosts, info, expect);
});

test('standalone desktop keeps each visited display at 1 FPS across sidebar navigation', async ({ page }, info) => {
  // Use the production viewer and real WebRTC with a local capture host behind the signaling adapter.
  await page.route('**/webChatConnection.ts*', route => route.fulfill({ contentType: 'application/javascript', body: `
    export function webChatConnection(session, deviceId, events) {
      return { start: events.ready, stop() {}, request: async (_, body) => {
        const { desktopRequest } = await import('/web/e2e/remote-desktop-fixture.ts');
        return desktopRequest(body);
      } };
    }` }));
  await page.goto('./?displays&three-displays');
  const nav = page.locator('.desktop-sidebar nav');
  const desktopTab = nav.getByRole('button', { name: '远程桌面', exact: true });
  await desktopTab.click();
  await page.getByRole('button', { name: /Office PC/ }).click();
  const video = page.locator('.rd-page video');
  await expect.poll(() => video.evaluate(el => el.videoWidth)).toBeGreaterThan(0);
  const second = page.locator('.rd-display-bar button').nth(1);
  await second.click();
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  const videoNode = await video.elementHandle();
  await nav.getByRole('button', { name: /下载/ }).click();
  await expect(page.locator('.rd-page')).toBeHidden();
  const rates = () => page.evaluate(() => Object.fromEntries(window.desktopTest.settingsRequests
    .map(({ settings }) => [settings.displayId, settings.fps])));
  await expect.poll(rates).toEqual({ 'display-1': 1, 'display-2': 1 });
  const frames = () => page.evaluate(() => ({ ...window.desktopTest.framesByDisplay }));
  const before = await frames();
  await expect.poll(async () => {
    const after = await frames();
    return Math.min(after['display-1'] - before['display-1'], after['display-2'] - before['display-2']);
  }).toBeGreaterThanOrEqual(2);
  const after = await frames();
  for (const id of ['display-1', 'display-2']) expect(after[id] - before[id]).toBeLessThanOrEqual(4);
  expect(after['display-3']).toBeUndefined();
  await page.screenshot({ path: info.outputPath('background.png') });
  await desktopTab.click();
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(rates).toEqual({ 'display-1': 1, 'display-2': 'auto' });
  await expect.poll(async () => (await frames())['display-2'] - after['display-2']).toBeGreaterThan(10);
  expect(await video.evaluate((el, previous) => el === previous, videoNode)).toBe(true);
  expect(await page.evaluate(() => [window.desktopTest.captures, window.desktopTest.closed])).toEqual([2, 0]);
  await expect.poll(() => video.evaluate(el => el.videoHeight > el.videoWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('restored.png') });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(rates).toEqual({ 'display-1': 1, 'display-2': 1 });
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'visibilityState');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(rates).toEqual({ 'display-1': 1, 'display-2': 'auto' });
  await page.locator('.rd-window-close').click();
  await expect.poll(() => page.evaluate(() => window.desktopTest.closed)).toBe(2);
});
