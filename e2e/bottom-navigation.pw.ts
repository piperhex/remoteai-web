import { expect, test } from '@playwright/test';

for (const dark of [false, true]) test(`icon navigation retains the browser ${dark}`, async ({ page }, info) => {
  const width = dark ? 390 : 320;
  await page.setViewportSize({ width, height: 844 });
  await page.addInitScript(dark => {
    localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light');
    localStorage.setItem('codex-switch:global-font-size', dark ? '20' : '14');
    localStorage.setItem('codex-switch.web.session.v1', JSON.stringify({ baseUrl: `${location.origin}/nav-fixture`,
      email: 'navigation@example.test', accessToken: 'fixture', refreshToken: 'fixture' }));
  }, dark);
  await page.route('**/nav-fixture/**', route => route.fulfill({ json: {
    accounts: [], providers: [], devices: [], email: 'navigation@example.test', id: 'navigation', ticket: 'fixture',
  } }));
  await page.routeWebSocket('**/nav-fixture/lounge/socket*', socket => {
    socket.onMessage(raw => {
      const frame = JSON.parse(String(raw));
      if (frame.type === 'authenticate') socket.send(JSON.stringify({ type: 'ready', bookmarks: true,
        user: { id: 'navigation', account: 'navigation@example.test' } }));
      if (frame.type === 'bookmarks-read') socket.send(JSON.stringify({ type: 'bookmarks', id: frame.id,
        document: { revision: 0, entries: [] } }));
    });
  });
  await page.route('**/retained-page', route => route.fulfill({ contentType: 'text/html',
    body: '<h1>Navigation fixture</h1><input aria-label="Draft" value="saved"><script>sessionStorage.saved="kept"</script>' }));
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  const navigation = page.locator('.mobile-tabbar');
  const tabs = navigation.getByRole('tab');
  await expect(tabs).toHaveCount(5);
  expect(await tabs.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))))
    .toEqual(['Agent Hub', '浏览器', '账号', '发现', '设置']);
  expect(await navigation.innerText()).toBe('');
  expect((await navigation.boundingBox())?.height).toBe(45);
  expect(await tabs.locator('svg').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width)))
    .toEqual([23, 23, 23, 23, 23]);
  await navigation.getByRole('tab', { name: '发现' }).click();
  await expect(page.locator('.discovery-page')).toBeVisible();
  await expect(page.locator('.discovery-page').getByRole('button', { name: '浏览器', exact: true })).toHaveCount(0);
  const label = `web-mobile-${width}-${dark ? 'dark-20px' : 'light-14px'}`;
  await expect(page.locator('.adm-toast-mask')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(`${label}-discovery.png`), animations: 'disabled' });
  await navigation.getByRole('tab', { name: '浏览器' }).click();
  await expect(navigation.getByRole('tab', { selected: true })).toHaveAccessibleName('浏览器');
  const browser = page.locator('.browser-main-page');
  const address = browser.getByLabel('页面地址', { exact: true });
  await address.fill(`${new URL(info.project.use.baseURL!).origin}/retained-page`);
  await address.press('Enter');
  const frame = browser.locator('iframe').first();
  await frame.contentFrame().getByRole('textbox', { name: 'Draft' }).fill('unsaved draft');
  const retained = await frame.elementHandle();
  const bounds = (await navigation.boundingBox())!;
  const content = (await browser.boundingBox())!;
  expect(content.y + content.height).toBeLessThanOrEqual(bounds.y + 1);
  await expect(page.locator('.adm-toast-mask')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(`${label}-browser.png`), animations: 'disabled' });
  for (const name of ['账号', '设置', 'Agent Hub']) {
    await navigation.getByRole('tab', { name, exact: true }).click();
    await expect(navigation.getByRole('tab', { selected: true })).toHaveAccessibleName(name);
    await navigation.getByRole('tab', { name: '浏览器' }).click();
    expect(await frame.evaluate((node, original) => node === original, retained)).toBe(true);
    await expect(frame.contentFrame().getByRole('textbox', { name: 'Draft' })).toHaveValue('unsaved draft');
    expect(await frame.evaluate(node => node.contentWindow?.sessionStorage.saved)).toBe('kept');
  }
  await browser.getByRole('button', { name: /管理标签页/ }).click();
  await expect(browser.getByRole('textbox', { name: '搜索标签页' })).toBeVisible();
  await expect(navigation).toBeVisible();
  await expect(page.locator('.adm-toast-mask')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(`${label}-tabs.png`), animations: 'disabled' });
  await navigation.getByRole('tab', { name: '发现' }).click();
  await expect(page.locator('.discovery-page')).toBeVisible();
});
