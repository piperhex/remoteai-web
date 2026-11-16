import { expect, test, type Page } from '@playwright/test';

async function openBrowser(page: Page, enlarged: boolean) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(enlarged => {
    localStorage.setItem('codex-switch.web.theme.v1', enlarged ? 'dark' : 'light');
    localStorage.setItem('codex-switch:global-font-size', enlarged ? '20' : '14');
    localStorage.setItem('codex-switch.web.session.v1', JSON.stringify({ baseUrl: `${location.origin}/tab-fixture`,
      email: 'browser@example.test', accessToken: 'fixture', refreshToken: 'fixture' }));
  }, enlarged);
  await page.route('**/tab-fixture/**', route => route.fulfill({ json: {
    accounts: [], providers: [], devices: [], email: 'browser@example.test', id: 'browser', ticket: 'fixture',
  } }));
  await page.routeWebSocket('**/tab-fixture/lounge/socket*', socket => socket.onMessage(raw => {
    const frame = JSON.parse(String(raw));
    if (frame.type === 'authenticate') socket.send(JSON.stringify({ type: 'ready', bookmarks: true,
      user: { id: 'browser', account: 'browser@example.test' } }));
    if (frame.type === 'bookmarks-read') socket.send(JSON.stringify({ type: 'bookmarks', id: frame.id,
      document: { revision: 1, entries: [] } }));
  }));
  await page.route('https://tabs.example/*', route => route.fulfill({ contentType: 'text/html',
    body: `<title>Page ${new URL(route.request().url()).pathname.slice(1)}</title><p>Retained page</p>` }));
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.locator('.mobile-tabbar').getByRole('tab', { name: '浏览器', exact: true }).click();
  await expect(page.locator('.adm-toast-mask')).toHaveCount(0);
}

for (const enlarged of [false, true]) test(`closing last and all mobile tabs returns home, enlarged=${enlarged}`,
  async ({ page }, info) => {
    await openBrowser(page, enlarged);
    const browser = page.locator('.browser-main-page');
    const manager = page.locator('.browser-tab-manager-toolbar');
    const address = browser.getByLabel('页面地址', { exact: true });
    const home = async () => {
      await expect(manager).toBeHidden(); await expect(address).toHaveValue('');
      await expect(browser.getByRole('button', { name: '管理标签页（1）' })).toBeVisible();
      await expect(browser.locator('.browser-home')).toBeVisible();
    };
    await browser.getByRole('button', { name: '管理标签页（1）' }).click();
    const add = await manager.getByRole('button', { name: '新标签页', exact: true }).boundingBox();
    const more = manager.getByRole('button', { name: '更多操作', exact: true });
    expect((await more.boundingBox())!.x).toBeGreaterThanOrEqual(add!.x + add!.width);
    await browser.getByRole('button', { name: '关闭 新标签页', exact: true }).click(); await home();
    await page.screenshot({ path: info.outputPath(`web-mobile-${enlarged ? 'dark-20px' : 'light-14px'}-last-tab-home.png`) });
    for (const name of ['one', 'two', 'three']) {
      if (name !== 'one') await browser.getByRole('button', { name: '新标签页', exact: true }).click();
      await address.fill(`https://tabs.example/${name}`); await address.press('Enter');
      await expect(address).toHaveValue(`https://tabs.example/${name}`);
    }
    await browser.getByRole('button', { name: '管理标签页（3）' }).click();
    await browser.locator('.browser-tab-card-header button').first().click();
    await expect(manager).toBeVisible(); await expect(browser.locator('.pm-browser-page')).toHaveCount(2);
    await more.click();
    const closeAll = page.getByRole('menuitem', { name: '关闭全部标签页', exact: true });
    await expect(closeAll).toBeVisible();
    await expect(page.locator('.browser-tab-manager-menu:visible')).not.toHaveClass(/-appear|-enter/);
    await page.screenshot({ path: info.outputPath(`web-mobile-${enlarged ? 'dark-20px' : 'light-14px'}-close-all-menu.png`) });
    await page.keyboard.press('Escape'); await expect(closeAll).toBeHidden();
    await manager.getByRole('textbox', { name: '搜索标签页' }).fill('missing');
    await expect(browser.getByText('没有匹配的标签页')).toBeVisible();
    await more.click(); await closeAll.click(); await home();
    await expect(browser.locator('iframe')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`web-mobile-${enlarged ? 'dark-20px' : 'light-14px'}-close-all-home.png`) });
    await browser.getByRole('button', { name: '管理标签页（1）' }).click();
    await more.click(); await closeAll.click(); await home();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.mobile-tabbar').getByRole('tab', { name: '浏览器', exact: true }).click(); await home();
  });
