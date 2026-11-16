import { expect, test } from '@playwright/test';

for (const enlarged of [false, true]) test(`mobile numeric searches stay stable, enlarged=${enlarged}`,
  async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(enlarged => {
      localStorage.setItem('codex-switch.web.theme.v1', enlarged ? 'dark' : 'light');
      localStorage.setItem('codex-switch:global-font-size', enlarged ? '20' : '14');
      localStorage.setItem('codex-switch.web.session.v1', JSON.stringify({
        baseUrl: `${location.origin}/numeric-fixture`, email: 'browser@example.test',
        accessToken: 'fixture', refreshToken: 'fixture',
      }));
    }, enlarged);
    await page.route('**/numeric-fixture/**', route => route.fulfill({ json: {
      accounts: [], providers: [], devices: [], email: 'browser@example.test', id: 'browser', ticket: 'fixture',
    } }));
    await page.routeWebSocket('**/numeric-fixture/lounge/socket*', socket => {
      socket.onMessage(raw => {
        const frame = JSON.parse(String(raw));
        if (frame.type === 'authenticate') socket.send(JSON.stringify({ type: 'ready', bookmarks: true,
          user: { id: 'browser', account: 'browser@example.test' } }));
        if (frame.type === 'bookmarks-read') socket.send(JSON.stringify({ type: 'bookmarks', id: frame.id,
          document: { revision: 1, entries: [] } }));
      });
    });
    const navigations: string[] = [];
    await page.route('https://www.google.com/search?*', route => {
      navigations.push(route.request().url());
      return route.fulfill({ contentType: 'text/html', body: '<h1>Numeric search result</h1>' });
    });
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    await page.locator('.mobile-tabbar').getByRole('tab', { name: '浏览器', exact: true }).click();
    const browser = page.locator('.browser-main-page');
    const address = browser.getByLabel('页面地址', { exact: true });
    for (const query of ['666', '664656', '666']) {
      await address.fill(query); await address.press('Enter');
      await expect(address).toHaveValue(`https://www.google.com/search?q=${query}`);
      await expect(browser.locator('iframe').contentFrame().getByRole('heading')).toHaveText('Numeric search result');
    }
    await page.waitForTimeout(1500);
    expect(navigations).toEqual(['666', '664656', '666'].map(query => `https://www.google.com/search?q=${query}`));
    await expect(page.locator('.adm-toast-mask')).toHaveCount(0);
    await address.focus(); await address.press('End');
    await page.screenshot({ path: info.outputPath(`web-mobile-${enlarged ? 'dark-20px' : 'light-14px'}-search-666.png`) });
  });
