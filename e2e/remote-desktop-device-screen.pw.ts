import { expect, test, type Page } from '@playwright/test';

const openMenu = (page: Page, name = '工作电脑') => page.getByRole('button', { name: `${name} 的更多操作` }).click();
const deviceAction = (page: Page, name: string) => page.getByRole('menuitem', { name, exact: true })
  .or(page.getByRole('button', { name, exact: true }));
const displayRow = (page: Page) => page.getByRole('menuitem', { name: /^显示器/ })
  .or(page.getByRole('button', { name: /^显示器/ }));

async function closeMenu(page: Page) {
  if (await page.locator('.device-menu-trigger').count()) {
    await page.getByRole('heading', { name: '设备管理', exact: true }).click();
    await expect(page.getByRole('menu')).toBeHidden();
  } else {
    await page.locator('.device-bottom-sheet .ant-drawer-close').click();
    await expect(page.locator('.device-bottom-sheet .ant-drawer-content')).toBeHidden();
  }
}

test('opens the online computer desktop from its mobile menu and returns to devices', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'The shortcut belongs to the mobile device menu.');
  await page.route('**/devices/*/screen-power', route => route.fulfill({ json: { state: 'on' } }));
  await page.goto('e2e/remote-desktop-harness.html?device-screen&touch');
  await openMenu(page, '离线电脑');
  await expect(deviceAction(page, '远程桌面')).toBeDisabled();
  await closeMenu(page);
  await openMenu(page);
  await expect(deviceAction(page, '关闭电脑屏幕')).toBeEnabled();
  const drawer = page.locator('.device-bottom-sheet .ant-drawer-content:visible');
  await expect.poll(async () => {
    const bounds = await drawer.boundingBox();
    return bounds && Math.abs(bounds.y + bounds.height - page.viewportSize()!.height);
  }).toBeLessThan(2);
  await expect(deviceAction(page, '远程桌面')).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath('device-desktop-menu.png') });
  await deviceAction(page, '远程桌面').click();
  const desktop = page.getByRole('dialog', { name: '远程桌面', exact: true });
  await expect(desktop).toBeVisible();
  await expect.poll(() => desktop.locator('video').evaluate(video => video.videoWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('device-desktop-stream.png'), animations: 'disabled' });
  await desktop.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(desktop).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '设备管理', exact: true })).toBeVisible();
});

test('screen off and restore stay in device management without opening a desktop', async ({ page }, info) => {
  const requests: unknown[] = [];
  let state = 'on';
  await page.route('**/devices/*/screen-power', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { state } });
    const command = route.request().postDataJSON();
    requests.push(command);
    state = command.action;
    return route.fulfill({ status: 204 });
  });
  const sockets: string[] = [];
  page.on('websocket', socket => {
    // Vite's development reload socket is unrelated to device or desktop connections.
    if (new URL(socket.url()).pathname !== '/web/') sockets.push(socket.url());
  });
  await page.goto('e2e/remote-desktop-harness.html?device-screen');
  const url = page.url();
  await openMenu(page);
  await expect(deviceAction(page, '关闭电脑屏幕')).toBeEnabled();
  await expect(deviceAction(page, '恢复电脑屏幕')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('display-on.png'), animations: 'disabled' });
  await deviceAction(page, '关闭电脑屏幕').click();
  await expect(page.getByText('暂时关闭电脑屏幕？')).toBeVisible();
  await expect(page.getByRole('menu')).not.toBeVisible();
  const drawer = page.locator('.device-screen-sheet .ant-drawer-content');
  await expect.poll(async () => {
    const bounds = (await drawer.boundingBox())!;
    return Math.abs(bounds.y + bounds.height - page.viewportSize()!.height);
  }).toBeLessThan(2);
  const box = (await drawer.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(440);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(Math.abs(box.y + box.height - page.viewportSize()!.height)).toBeLessThan(2);
  expect((await page.locator('.device-screen-explanation').boundingBox())!.width).toBeLessThanOrEqual(400);
  await expect(page.getByRole('button', { name: '取消', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('screen-confirmation.png'), animations: 'disabled' });
  await page.locator('.device-screen-sheet .ant-drawer-close').click();
  await expect(drawer).not.toBeVisible();
  expect(requests).toEqual([]);
  await openMenu(page);
  await deviceAction(page, '关闭电脑屏幕').click();
  await drawer.getByRole('button', { name: '关闭电脑屏幕', exact: true }).click();
  await expect(page.getByText('已发送关闭屏幕指令')).toBeVisible();
  expect(requests).toEqual([{ action: 'off' }]);
  await expect(page.getByRole('heading', { name: '设备管理', exact: true })).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  await openMenu(page);
  await expect(deviceAction(page, '恢复电脑屏幕')).toBeEnabled();
  await expect(deviceAction(page, '关闭电脑屏幕')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('display-off.png'), animations: 'disabled' });
  await deviceAction(page, '恢复电脑屏幕').click();
  await expect(page.getByText('已发送恢复显示指令')).toBeVisible();
  expect(requests).toEqual([{ action: 'off' }, { action: 'on' }]);
  expect(page.url()).toBe(url);
  expect(sockets).toEqual([]);
  await expect(page.getByRole('dialog', { name: '远程桌面', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('screen-restored.png') });
});

test('offline, older and unsupported devices cannot send screen commands', async ({ page }, info) => {
  const requests: string[] = [];
  await page.route('**/devices/*/screen-power', route => {
    requests.push(route.request().method());
    return route.abort();
  });
  await page.goto('e2e/remote-desktop-harness.html?device-screen');
  await openMenu(page, '离线电脑');
  await expect(displayRow(page)).toBeDisabled();
  await expect(displayRow(page)).toContainText('离线');
  await page.screenshot({ path: info.outputPath('device-offline.png'), animations: 'disabled' });
  await closeMenu(page);
  await openMenu(page, '旧版电脑');
  await expect(displayRow(page)).toBeDisabled();
  await expect(displayRow(page)).toContainText('请先更新电脑上的 Remote AI。');
  await closeMenu(page);
  await openMenu(page, 'Mac');
  await expect(displayRow(page)).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('failures remain on the device page and allow retry', async ({ page }) => {
  let fail = true;
  await page.route('**/devices/*/screen-power', route => route.fulfill(route.request().method() === 'GET'
    ? { json: { state: 'off' } }
    : fail ? { status: 409, json: { message: 'client.deviceScreen.updateRequired' } } : { status: 204 }));
  await page.goto('e2e/remote-desktop-harness.html?device-screen');
  await openMenu(page);
  await deviceAction(page, '恢复电脑屏幕').click();
  await expect(page.getByText('请先更新电脑上的 Remote AI。')).toBeVisible();
  await expect(page.getByRole('heading', { name: '设备管理', exact: true })).toBeVisible();
  fail = false;
  await openMenu(page);
  await deviceAction(page, '恢复电脑屏幕').click();
  await expect(page.getByText('已发送恢复显示指令')).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
});

test('open menu follows external changes and disables the action when Windows cannot report its state', async ({ page }, info) => {
  let state = 'on';
  await page.route('**/devices/*/screen-power', route => route.fulfill({ json: { state } }));
  await page.goto('e2e/remote-desktop-harness.html?device-screen');
  await openMenu(page);
  await expect(deviceAction(page, '关闭电脑屏幕')).toBeEnabled();
  state = 'off';
  await expect(deviceAction(page, '恢复电脑屏幕')).toBeEnabled({ timeout: 8_000 });
  state = 'unknown';
  await expect(displayRow(page)).toContainText('操作未完成', { timeout: 8_000 });
  await expect(displayRow(page)).toBeDisabled();
  await page.screenshot({ path: info.outputPath('display-unavailable.png'), animations: 'disabled' });
});
