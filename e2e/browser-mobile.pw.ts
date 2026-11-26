import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { verifyFullscreenControl } from './browser-fullscreen-checks';
import { verifyBrowserMouse } from './browser-mouse-checks';
import { verifyBrowserMouseEdge } from './browser-mouse-edge';

test('mobile browser mouse controls operate the active page', verifyBrowserMouse);
test('mobile browser pans into the margin and keeps the pointer across navigation', verifyBrowserMouseEdge);

test('mobile browser bounds live frames and reopens an evicted tab at its saved URL', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('codex-switch.web.session.v1', JSON.stringify({
    baseUrl: `${location.origin}/renderer-account`, email: 'browser@example.test',
    accessToken: 'fixture', refreshToken: 'fixture',
  })));
  await page.route('**/renderer-account/**', route => route.fulfill({ json: {
    accounts: [], devices: [], providers: [], email: 'browser@example.test', id: 'browser', ticket: 'fixture',
  } }));
  await page.route('**/renderer-page/*', route => route.fulfill({ contentType: 'text/html',
    body: `<h1>Page ${new URL(route.request().url()).pathname.split('/').pop()}</h1>
      <a href="/renderer-page/detail">Open details</a>` }));
  await page.goto('./');
  const navigation = page.locator('.mobile-tabbar');
  const open = navigation.getByRole('tab', { name: '浏览器', exact: true });
  await open.click();
  const browser = page.locator('.browser-main-page');
  const address = browser.getByLabel('页面地址', { exact: true });
  for (const number of [1, 2, 3, 4]) {
    if (number > 1) await browser.getByRole('button', { name: '新标签页', exact: true }).click();
    await address.fill(`${new URL(info.project.use.baseURL!).origin}/renderer-page/${number}`);
    await address.press('Enter');
    const selected = browser.locator('.browser-tab-selected iframe').contentFrame();
    await expect(selected.getByRole('heading')).toHaveText(`Page ${number}`);
    if (number === 1) {
      await selected.getByRole('link').click();
      await expect(selected.getByRole('heading')).toHaveText('Page detail');
    }
    await expect(browser.locator('iframe')).toHaveCount(Math.min(number, 3));
  }
  await browser.getByRole('button', { name: '管理标签页（4）' }).click();
  await expect(browser.locator('.browser-tab-select')).toHaveCount(4);
  await expect(page.locator('.adm-toast-mask')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('web-mobile-budget-four-tabs.png') });
  await browser.locator('.browser-tab-select').first().click();
  await expect(address).toHaveValue(/\/renderer-page\/detail$/);
  const restored = browser.locator('.browser-tab-selected iframe').contentFrame().getByRole('heading');
  await expect(restored).toHaveText('Page detail');
  await navigation.getByRole('tab', { name: '发现', exact: true }).click();
  await expect(browser.locator('iframe')).toHaveCount(1);
  await open.click();
  await expect(restored).toHaveText('Page detail');
  await page.screenshot({ path: info.outputPath('web-mobile-budget-restored-tab.png') });
});

test('mobile browser sends readable website downloads to the app manager', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
    localStorage.setItem('codex-switch.web.session.v1', JSON.stringify({
      baseUrl: `${location.origin}/website-download-fixture`, email: 'download@example.test',
      accessToken: 'fixture', refreshToken: 'fixture',
    }));
  });
  await page.route('**/website-download-fixture/**', route => route.fulfill({ json: {
    accounts: [], providers: [], devices: [], email: 'download@example.test', id: 'download', ticket: 'fixture',
  } }));
  await page.route('**/website-download-page', route => route.fulfill({ contentType: 'text/html',
    body: `
      <a download="website-report.txt" href="/website-download-file">Download report</a>
      <button onclick="exportReport()">Export generated report</button>
      <a download="inline.txt" href="data:text/plain;base64,AAH+/w==">Export inline file</a>
      <script>
        function exportReport() {
          const url = URL.createObjectURL(new Blob(['generated report'], { type: 'text/plain' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = 'generated-report.txt';
          link.click();
          URL.revokeObjectURL(url);
        }
      </script>
    ` }));
  await page.route('**/website-download-file', route => route.fulfill({ contentType: 'text/plain', body: 'website report' }));
  await page.goto('./');
  await page.locator('.mobile-tabbar').getByRole('tab', { name: '浏览器', exact: true }).click();
  const browser = page.locator('.browser-main-page');
  const address = browser.getByLabel('页面地址', { exact: true });
  await address.fill(`${new URL(info.project.use.baseURL!).origin}/website-download-page`);
  await address.press('Enter');
  const link = browser.locator('iframe').first().contentFrame().getByRole('link', { name: 'Download report' });
  await link.click();
  const added = page.getByText('已加入下载管理。');
  await expect(added).toBeVisible();
  await expect(added).toBeHidden();
  await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
  const downloads = page.locator('.browser-bookmark-settings-popup').getByRole('button', { name: '下载管理' });
  await expect(downloads).toBeVisible();
  await page.screenshot({ path: info.outputPath('web-mobile-browser-download-menu.png'), animations: 'disabled' });
  await downloads.click();
  const task = page.getByRole('article', { name: 'website-report.txt' });
  await expect(task.getByText('文件已就绪')).toBeVisible();
  await page.screenshot({ path: info.outputPath('web-mobile-browser-download-ready.png'), animations: 'disabled' });
  const saved = page.waitForEvent('download');
  await task.getByRole('button', { name: '保存到设备' }).click();
  const file = await saved;
  expect(file.suggestedFilename()).toBe('website-report.txt');
  expect(await readFile(await file.path(), 'utf8')).toBe('website report');
  await page.locator('.downloads-page').getByRole('button', { name: '返回', exact: true }).click();
  await expect(link).toBeVisible();

  const iframe = browser.locator('iframe').first().contentFrame();
  await iframe.getByRole('button', { name: 'Export generated report' }).click();
  await iframe.getByRole('link', { name: 'Export inline file' }).click();
  await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
  await downloads.click();
  for (const [name, expected] of [
    ['generated-report.txt', Buffer.from('generated report')],
    ['inline.txt', Buffer.from([0, 1, 254, 255])],
  ] as const) {
    const generated = page.getByRole('article', { name, exact: true });
    await expect(generated.getByText('文件已就绪')).toBeVisible();
    const saved = page.waitForEvent('download');
    await generated.getByRole('button', { name: '保存到设备' }).click();
    const savedFile = await saved;
    expect(savedFile.suggestedFilename()).toBe(name);
    expect(await readFile(await savedFile.path())).toEqual(expected);
  }
  await expect(added).toBeHidden();
  await page.screenshot({ path: info.outputPath('web-mobile-generated-downloads.png'), animations: 'disabled' });
  await page.locator('.downloads-page').getByRole('button', { name: '返回', exact: true }).click();

  const outside = new URL(info.project.use.baseURL!);
  outside.port = '1580';
  await page.route(`${outside.origin}/foreign-download-page`, route => route.fulfill({ contentType: 'text/html',
    body: '<a href="/foreign-download-file">Download from another site</a>' }));
  await page.route(`${outside.origin}/foreign-download-file`, route => route.fulfill({ body: 'browser-owned file',
    headers: { 'Content-Type': 'text/plain', 'Content-Disposition': 'attachment; filename="foreign.txt"' } }));
  await address.fill(`${outside.origin}/foreign-download-page`);
  await address.press('Enter');
  const browserSaved = page.waitForEvent('download');
  await browser.locator('iframe').first().contentFrame().getByRole('link', { name: 'Download from another site' }).click();
  expect((await browserSaved).suggestedFilename()).toBe('foreign.txt');
  await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
  await downloads.click();
  await expect(page.locator('.download-tasks article')).toHaveCount(3);
});

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
  const tabAddress = browser.getByLabel('页面地址', { exact: true });
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
  await expect(browser.getByLabel('页面地址', { exact: true })).toBeHidden();
  await expect(browser.getByRole('button', { name: '更多操作', exact: true })).toBeVisible();
  await expect(second.contentFrame().locator('input')).toHaveValue('mode-draft');
  await expect.poll(() => browser.evaluate(element => element.matches(':popover-open'))).toBe(true);
  const fullscreenBounds = await browser.boundingBox();
  expect(fullscreenBounds).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath(`web-mobile-${dark ? 'dark-20px' : 'light-14px'}-fullscreen.png`),
    animations: 'disabled' });
  await verifyFullscreenControl({ page, browser, info, label: `web-mobile-${dark ? 'dark-20px' : 'light-14px'}` });
  await expect(browser.getByLabel('页面地址', { exact: true })).toBeVisible();
  await expect(second.contentFrame().locator('input')).toHaveValue('mode-draft');
  await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
  await popup.getByRole('button', { name: '全屏展示', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(browser.getByLabel('页面地址', { exact: true })).toBeVisible();
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
  const address = browser.getByLabel('页面地址', { exact: true });
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
