import type { expect as expectTest, Locator, Page, TestInfo } from '@playwright/test';
import type { desktopRequest, desktopTest } from './remote-desktop-fixture';

declare global {
  interface Window { desktopTest: typeof desktopTest; captureRequest: typeof desktopRequest }
}

export const computers = [
  { deviceId: 'office', name: 'Office PC', online: true },
  { deviceId: 'studio', name: 'Studio PC', online: true },
  { deviceId: 'offline', name: 'Home PC', online: false },
].map(device => ({ ...device, platform: 'Windows', capabilities: [] }));

/** Each computer owns its own host, capture clock and WebRTC peer in a separate page. */
export async function connectCaptureHosts(page: Page, fixtureUrl: string, adapter: string) {
  const hosts = new Map<string, Page>();
  for (const device of computers.filter(device => device.online)) {
    const host = await page.context().newPage();
    await host.route('**/capture-host.html*', route => route.fulfill({ contentType: 'text/html',
      body: `<script type="module">import {desktopRequest} from ${JSON.stringify(fixtureUrl)};
        window.captureRequest = desktopRequest;</script>` }));
    await host.goto('capture-host.html?displays&audio');
    await host.waitForFunction(() => !!window.captureRequest);
    hosts.set(device.deviceId, host);
  }
  await page.exposeFunction('sendDesktopRequest', (id: string, body: object) =>
    hosts.get(id)!.evaluate(request => window.captureRequest(request), body));
  await page.route(`**/${adapter}.ts*`, route => route.fulfill({ contentType: 'application/javascript',
    body: `export function ${adapter}(identity, deviceId, events) {
      return { start: events.ready, stop() {}, request: (_, body) => window.sendDesktopRequest(deviceId, body) };
    }` }));
  return { office: hosts.get('office')!, studio: hosts.get('studio')! };
}

const frames = (host: Page) => host.evaluate(() => window.desktopTest.frames);
const rate = (host: Page) => host.evaluate(() => window.desktopTest.settings.at(-1)?.fps);
const sessions = (host: Page) => host.evaluate(() => [window.desktopTest.captures, window.desktopTest.closed]);

function tabAudio(viewer: Locator) {
  return viewer.locator('video').evaluateAll((videos: HTMLVideoElement[]) => videos.map(video => {
    const track = (video.srcObject as MediaStream | null)?.getAudioTracks()[0];
    return track?.readyState === 'live' ? track.enabled && !video.muted : null;
  }));
}

async function checkManualMute(viewer: Locator, info: TestInfo, expect: typeof expectTest) {
  await viewer.getByRole('button', { name: '静音', exact: true }).click();
  await viewer.getByRole('tab', { name: 'Studio PC' }).click();
  await expect.poll(() => tabAudio(viewer)).toEqual([false, true]);
  await viewer.getByRole('tab', { name: 'Office PC' }).click();
  await expect.poll(() => tabAudio(viewer)).toEqual([false, false]);
  await expect(viewer.getByRole('button', { name: '开启声音', exact: true })).toBeVisible();
  await viewer.page().screenshot({ path: info.outputPath('restored-manual-mute.png'), animations: 'disabled' });
}

async function checkAddButtonPosition(page: Page, expect: typeof expectTest) {
  const bar = page.locator('.rd-computer-tabs > .ant-tabs-nav');
  const tab = await bar.locator('.ant-tabs-tab').last().boundingBox();
  const add = await bar.getByRole('button', { name: '选择电脑' }).boundingBox();
  expect(tab).toBeTruthy();
  expect(add).toBeTruthy();
  const gap = add!.x - (tab!.x + tab!.width);
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThanOrEqual(8);
}

async function checkComputerPicker(page: Page, info: TestInfo, expect: typeof expectTest) {
  const picker = page.locator('.rd-page').getByRole('button', { name: '选择电脑' });
  const menu = page.getByRole('menu', { name: '选择电脑' });
  for (const gesture of ['click', 'right-click', 'long-press']) {
    if (gesture === 'long-press') {
      await picker.dispatchEvent('pointerdown', { pointerType: 'touch', button: 0, isPrimary: true });
    } else await picker.click({ button: gesture === 'click' ? 'left' : 'right' });
    await expect(menu.getByRole('menuitem', { name: 'Studio PC' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /Office PC/ })).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: /Home PC/ })).toHaveAttribute('aria-disabled', 'true');
    if (gesture === 'long-press') {
      await picker.dispatchEvent('pointerup', { pointerType: 'touch', button: 0, isPrimary: true });
      await page.screenshot({ path: info.outputPath('add-computer.png'), animations: 'disabled' });
    } else {
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
    }
  }
  await menu.getByRole('menuitem', { name: 'Studio PC' }).click();
}

export async function checkDesktopTabs(page: Page, hosts: { office: Page; studio: Page },
  info: TestInfo, expect: typeof expectTest) {
  const viewer = page.locator('.rd-page');
  const activeVideo = viewer.getByRole('tabpanel').locator('video');
  const waitForVideo = () => expect.poll(() => activeVideo.evaluate(video => video.videoWidth)).toBeGreaterThan(0);
  const sound = () => tabAudio(viewer);
  const heading = viewer.getByRole('heading', { name: '选择电脑' });
  await expect(heading).toHaveCSS('cursor', 'default');
  await expect(heading).toHaveCSS('caret-color', 'rgba(0, 0, 0, 0)');
  await heading.dblclick();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('');
  await expect(page.locator('.adm-toast-mask')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('choose-computer.png'), animations: 'disabled' });
  await viewer.getByRole('button', { name: /Office PC/ }).click();
  await waitForVideo();
  await expect.poll(sound).toEqual([true]);
  const officeVideo = await activeVideo.elementHandle();
  await viewer.getByRole('button', { name: '键盘', exact: true }).click();
  const input = viewer.getByRole('textbox', { name: '发送到电脑的文字' });
  await expect(input).toHaveCSS('user-select', 'text');
  await input.fill('local text');
  await expect.poll(() => hosts.office.evaluate(() => window.desktopTest.inputs.at(-1)))
    .toEqual({ kind: 'text', text: 'local text' });
  await viewer.getByRole('button', { name: '收起键盘' }).click();
  await checkAddButtonPosition(page, expect);
  await checkComputerPicker(page, info, expect);
  await waitForVideo();
  await expect(viewer.getByRole('tab', { name: 'Studio PC' })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => rate(hosts.office)).toBe(1);
  await checkAddButtonPosition(page, expect);
  await expect.poll(() => rate(hosts.studio)).toBe('auto');
  await expect.poll(sound).toEqual([false, true]);
  const officeBefore = await frames(hosts.office);
  const studioBefore = await frames(hosts.studio);
  await expect.poll(async () => await frames(hosts.office) - officeBefore).toBeGreaterThanOrEqual(2);
  expect(await frames(hosts.office) - officeBefore).toBeLessThanOrEqual(4);
  expect(await frames(hosts.studio) - studioBefore).toBeGreaterThan(5);
  await page.screenshot({ path: info.outputPath('two-computers.png'), animations: 'disabled' });

  const navigation = page.getByRole('navigation').filter({ has: page.getByRole('button', { name: /^下载/ }) });
  await navigation.getByRole('button', { name: /^下载/ }).click();
  await expect(viewer).toBeHidden();
  await expect.poll(sound).toEqual([false, false]);
  await expect.poll(() => rate(hosts.studio)).toBe(1);
  expect(await rate(hosts.office)).toBe(1);
  await navigation.getByRole('button', { name: '远程桌面', exact: true }).click();
  await expect.poll(() => rate(hosts.studio)).toBe('auto');
  await expect.poll(sound).toEqual([false, true]);
  expect(await rate(hosts.office)).toBe(1);
  await viewer.getByRole('tab', { name: 'Office PC' }).click();
  await expect.poll(() => rate(hosts.office)).toBe('auto');
  await expect.poll(() => rate(hosts.studio)).toBe(1);
  await expect.poll(sound).toEqual([true, false]);
  expect(await activeVideo.evaluate((video, previous) => video === previous, officeVideo)).toBe(true);
  await checkManualMute(viewer, info, expect);
  await viewer.locator('[data-node-key="studio"] .ant-tabs-tab-remove').click();
  await expect.poll(() => sessions(hosts.studio)).toEqual([1, 1]);
  expect(await sessions(hosts.office)).toEqual([1, 0]);
  await viewer.getByRole('button', { name: '选择电脑' }).click();
  await page.getByRole('menuitem', { name: 'Studio PC' }).click();
  await waitForVideo();
  await viewer.locator('[data-node-key="studio"] .ant-tabs-tab-remove').click();
  await expect(viewer.getByRole('tab', { name: 'Office PC' })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => sessions(hosts.studio)).toEqual([2, 2]);
  await viewer.locator('[data-node-key="office"] .ant-tabs-tab-remove').click();
  await expect(viewer.getByRole('button', { name: /Office PC/ })).toBeVisible();
  await expect.poll(() => sessions(hosts.office)).toEqual([1, 1]);
}
