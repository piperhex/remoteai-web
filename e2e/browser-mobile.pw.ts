import { expect, test } from '@playwright/test';
import { verifyFullscreenControl } from './browser-fullscreen-checks';

for (const dark of [false, true]) test(`mobile browser retains pages and opens bookmark drawer ${dark}`, async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(dark => {
    localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light');
    localStorage.setItem('codex-switch:global-font-size', dark ? '20' : '14');
    localStorage.setItem('codex-switch.web.session.v1', JSON.stringify({ baseUrl: `${location.origin}/bookmark-fixture`,
      email: 'bookmarks@example.test', accessToken: 'fixture', refreshToken: 'fixture' }));
  }, dark);
  await page.route('**/bookmark-fixture/**', route => route.fulfill({ json: {
    accounts: [], providers: [], devices: [], email: 'bookmarks@example.test', id: 'bookmarks', ticket: 'fixture',
  } }));
  await page.routeWebSocket('**/bookmark-fixture/lounge/socket*', socket => {
    socket.onMessage(raw => {
      const frame = JSON.parse(String(raw));
      if (frame.type === 'authenticate') socket.send(JSON.stringify({ type: 'ready', bookmarks: true,
        user: { id: 'bookmarks', account: 'bookmarks@example.test' } }));
      if (frame.type === 'bookmarks-read') socket.send(JSON.stringify({ type: 'bookmarks', id: frame.id,
        document: { revision: 1, entries: [{ id: 'pc-link', kind: 'link', title: 'PC bookmark',
          url: `${new URL(info.project.use.baseURL!).origin}/session-fixture`, parentId: '', position: 0 }] } }));
    });
  });
  await page.route('**/session-fixture', route => route.fulfill({ contentType: 'text/html',
    body: '<h1>Retained browser page</h1><input value="draft-kept"><script>sessionStorage.saved="retained"</script>' }));
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.locator('.mobile-tabbar').getByRole('tab', { name: '发现', exact: true }).click();
  await expect(page.locator('.discovery-page')).toBeVisible();
  await expect(page.locator('.adm-toast-mask')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(`web-mobile-${dark ? 'dark-20px' : 'light-14px'}-discovery.png`),
    animations: 'disabled' });
  await page.locator('.mobile-tabbar').getByRole('tab', { name: '浏览器', exact: true }).click();
  const browser = page.locator('.browser-main-page');
  await expect(browser).toBeVisible();
  await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
  await page.getByRole('button', { name: '所有书签', exact: true }).last().click();
  const drawer = page.locator('.browser-bookmark-drawer');
  await expect(drawer.getByRole('button', { name: /PC bookmark/ })).toBeVisible();
  await expect(drawer).not.toHaveClass(/-enter/);
  await expect.poll(async () => (await drawer.locator('.ant-drawer-content-wrapper').boundingBox())?.y ?? 844)
    .toBeLessThan(220);
  await page.screenshot({ path: info.outputPath(`web-mobile-${dark ? 'dark-20px' : 'light-14px'}-bookmarks.png`),
    animations: 'disabled' });
  await drawer.getByRole('button', { name: /PC bookmark/ }).click();
  const frame = browser.locator('iframe').first();
  await expect(frame.contentFrame().getByRole('heading', { name: 'Retained browser page' })).toBeVisible();
  await frame.contentFrame().locator('input').fill('unsaved-draft');
  const retained = await frame.elementHandle();
  await page.locator('.mobile-tabbar').getByRole('tab', { name: '发现', exact: true }).click();
  await page.locator('.mobile-tabbar').getByRole('tab', { name: '浏览器', exact: true }).click();
  expect(await frame.evaluate((node, previous) => node === previous, retained)).toBe(true);
  await expect(frame.contentFrame().locator('input')).toHaveValue('unsaved-draft');
  expect(await frame.evaluate(node => node.contentWindow?.sessionStorage.saved)).toBe('retained');
  await page.route('**/second-tab', route => route.fulfill({ contentType: 'text/html',
    body: '<h1>Second retained tab</h1><input value="second-draft">' }));
  await browser.getByRole('button', { name: '新标签页', exact: true }).click();
  const tabAddress = browser.getByRole('textbox', { name: '页面地址', exact: true });
  await tabAddress.fill(`${new URL(info.project.use.baseURL!).origin}/second-tab`);
  await tabAddress.press('Enter');
  await expect(browser.locator('iframe').last().contentFrame().getByRole('heading')).toHaveText('Second retained tab');
  const second = browser.locator('iframe').last();
  await second.contentFrame().locator('input').fill('mode-draft');
  await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
  const popup = page.locator('.browser-bookmark-settings-popup');
  const quickAdd = popup.getByRole('button', { name: '添加书签', exact: true });
  await quickAdd.click(); await expect(quickAdd).toBeDisabled();
  await expect(page.getByRole('dialog', { name: '添加书签' })).toHaveCount(0);
  const desktopSite = popup.getByRole('checkbox', { name: '桌面版网站' });
  await desktopSite.check();
  await expect.poll(() => second.evaluate(node => node.contentWindow?.innerWidth)).toBe(980);
  await page.screenshot({ path: info.outputPath(`web-mobile-${dark ? 'dark-20px' : 'light-14px'}-desktop-settings.png`),
    animations: 'disabled' });
  await desktopSite.uncheck();
  await expect.poll(() => second.evaluate(node => node.contentWindow?.innerWidth)).toBeLessThan(500);
  await expect(second.contentFrame().locator('input')).toHaveValue('mode-draft');
  const reload = popup.getByRole('button', { name: '刷新', exact: true });
  await expect(popup.getByRole('button', { name: /^关\s*闭$/ })).toHaveCount(0);
  expect((await reload.boundingBox())!.y).toBeLessThan((await quickAdd.boundingBox())!.y);
  await page.screenshot({ path: info.outputPath(`web-mobile-${dark ? 'dark-20px' : 'light-14px'}-refresh-menu.png`),
    animations: 'disabled' });
  await popup.getByRole('button', { name: '全屏展示', exact: true }).click();
  await expect(browser.getByRole('textbox', { name: '页面地址', exact: true })).toBeHidden();
  await expect(browser.getByRole('button', { name: '更多操作', exact: true })).toBeVisible();
  await expect(second.contentFrame().locator('input')).toHaveValue('mode-draft');
  await expect.poll(() => browser.evaluate(element => element.matches(':popover-open'))).toBe(true);
  const fullscreenBounds = await browser.boundingBox();
  expect(fullscreenBounds).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath(`web-mobile-${dark ? 'dark-20px' : 'light-14px'}-fullscreen.png`),
    animations: 'disabled' });
  await verifyFullscreenControl({ page, browser, info, label: `web-mobile-${dark ? 'dark-20px' : 'light-14px'}` });
  await expect(browser.getByRole('textbox', { name: '页面地址', exact: true })).toBeVisible();
  await expect(second.contentFrame().locator('input')).toHaveValue('mode-draft');
  await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
  await popup.getByRole('button', { name: '全屏展示', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(browser.getByRole('textbox', { name: '页面地址', exact: true })).toBeVisible();
  await expect(second.contentFrame().locator('input')).toHaveValue('mode-draft');
  await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
  await reload.click();
  await expect(popup).toBeHidden();
  await expect(second.contentFrame().locator('input')).toHaveValue('second-draft');
  await expect(frame.contentFrame().locator('input')).toHaveValue('unsaved-draft');
  await expect(browser.getByRole('button', { name: '管理标签页（2）' })).toBeVisible();
  await page.screenshot({ path: info.outputPath(`web-mobile-${dark ? 'dark-20px' : 'light-14px'}-refreshed.png`),
    animations: 'disabled' });
  await page.screenshot({ path: info.outputPath(`web-mobile-${dark ? 'dark-20px' : 'light-14px'}-page.png`),
    animations: 'disabled' });
  await expect(browser.getByRole('button', { name: '刷新', exact: true })).toHaveCount(0);
  await browser.getByRole('button', { name: '管理标签页（2）', exact: true }).click();
  const grid = browser.locator('.browser-tab-grid');
  await expect(grid.locator('.pm-browser-page:visible')).toHaveCount(2);
  await page.screenshot({ path: info.outputPath(`web-mobile-${dark ? 'dark-20px' : 'light-14px'}-tabs.png`),
    animations: 'disabled' });
  await browser.getByRole('textbox', { name: '搜索标签页' }).fill('missing-tab');
  await expect(browser.getByText('没有匹配的标签页')).toBeVisible();
  await browser.getByRole('textbox', { name: '搜索标签页' }).fill('session-fixture');
  await expect(grid.locator('.pm-browser-page:visible')).toHaveCount(1);
  await grid.locator('.browser-tab-select:visible').click();
  expect(await frame.evaluate((node, previous) => node === previous, retained)).toBe(true);
  await expect(frame.contentFrame().locator('input')).toHaveValue('unsaved-draft');
  await tabAddress.fill(`${new URL(info.project.use.baseURL!).origin}/second-tab`); await tabAddress.press('Enter');
  const cdp = await page.context().newCDPSession(page);
  const swipe = async (side: 'left' | 'right', distance = 125) => {
    const bounds = await browser.locator(`.browser-gesture-${side}`).boundingBox();
    const startX = side === 'left' ? bounds!.x + 2 : bounds!.x + bounds!.width - 2;
    const y = bounds!.y + 150;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y }] });
    for (let index = 1; index <= 5; index++) await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: startX + (side === 'left' ? 1 : -1) * index * distance / 5, y }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await swipe('left', 10); await expect(tabAddress).toHaveValue(/\/second-tab$/);
  await swipe('left'); await expect(tabAddress).toHaveValue(/\/session-fixture$/);
  await tabAddress.fill(`${new URL(info.project.use.baseURL!).origin}/second-tab`); await tabAddress.press('Enter');
  await expect(tabAddress).toHaveValue(/\/second-tab$/);
  await swipe('right'); await expect(tabAddress).toHaveValue(/\/session-fixture$/);
  await page.screenshot({ path: info.outputPath(`web-mobile-${dark ? 'dark-20px' : 'light-14px'}-left-swipe-back.png`) });
  await expect(browser).toBeVisible();
  await browser.getByRole('button', { name: '管理标签页（2）' }).click();
  const swipeCard = async (dx: number, dy = 0) => {
    const bounds = await grid.locator('.browser-tab-select').first().boundingBox();
    const x = bounds!.x + bounds!.width / 2; const y = bounds!.y + 70;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 5; step++) await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: x + dx * step / 5, y: y + dy * step / 5 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  for (const [dx, dy] of [[30, 0], [-70, 0], [5, 100]]) {
    await swipeCard(dx, dy); await expect(grid).toBeVisible();
    await expect(grid.locator('.pm-browser-page')).toHaveCount(2);
  }
  await swipeCard(120); await expect(grid).toBeVisible(); await cdp.detach();
  await expect(grid.locator('.pm-browser-page')).toHaveCount(1);
  await page.screenshot({ path: info.outputPath(`web-mobile-${dark ? 'dark-20px' : 'light-14px'}-swipe-removed.png`),
    animations: 'disabled' });
  await grid.locator('.browser-tab-card-header button').click();
  await expect(grid).toBeHidden();
  await expect(browser.getByRole('button', { name: '管理标签页（1）' })).toBeVisible();
  await expect(tabAddress).toHaveValue('');
  await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
  await popup.getByRole('button', { name: '全屏展示', exact: true }).click();
  await page.screenshot({ path: info.outputPath(`web-mobile-${dark ? 'dark-20px' : 'light-14px'}-home-circle.png`),
    animations: 'disabled' });
  await browser.getByRole('button', { name: '更多操作', exact: true }).tap();
  await expect(browser.locator('.browser-fullscreen-popover')).toHaveCSS('opacity', '1');
  await expect(browser.locator('.browser-fullscreen-popover')).not.toHaveClass(/zoom-big-(enter|appear|leave)/);
  await page.screenshot({ path: info.outputPath(`web-mobile-${dark ? 'dark-20px' : 'light-14px'}-home-menu.png`),
    animations: 'disabled' });
  await browser.getByRole('menuitem', { name: '退出全屏', exact: true }).click();
  await page.route(/^https:\/\/(www\.google\.com|www\.baidu\.com)/,
    route => route.fulfill({ contentType: 'text/html', body: '<h1>Search result fixture</h1>' }));
  const address = browser.getByRole('textbox', { name: '页面地址', exact: true });
  await address.fill('mobile search'); await address.press('Enter');
  await expect(address).toHaveValue('https://www.google.com/search?q=mobile+search');
  await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
  await page.locator('.browser-bookmark-settings-popup .ant-select-selector').click();
  await page.getByTitle('百度', { exact: true }).last().click();
  await expect(page.locator('.browser-bookmark-settings-popup .ant-select-dropdown:visible')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('remoteai:browser-search-engine'))).toBe('baidu');
  await page.screenshot({ path: info.outputPath(`web-mobile-${dark ? 'dark-20px' : 'light-14px'}-search-settings.png`),
    animations: 'disabled' });
  await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
  await address.fill('手机搜索'); await address.press('Enter');
  await expect(address).toHaveValue('https://www.baidu.com/s?wd=%E6%89%8B%E6%9C%BA%E6%90%9C%E7%B4%A2');
  await page.reload();
  await page.locator('.mobile-tabbar').getByRole('tab', { name: '发现', exact: true }).click();
  await page.locator('.mobile-tabbar').getByRole('tab', { name: '浏览器', exact: true }).click();
  await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
  await expect(page.locator('.browser-bookmark-settings-popup')).toContainText('百度');
});
