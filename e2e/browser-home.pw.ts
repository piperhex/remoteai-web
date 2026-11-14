import { expect, test, type Page } from '@playwright/test';

async function swipe(page: Page, side: 'left' | 'right') {
  const bounds = (await page.locator(`.browser-gesture-${side}:visible`).boundingBox())!;
  const start = side === 'left' ? bounds.x + 3 : bounds.x + bounds.width - 3;
  const y = bounds.y + 150;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] });
  for (let step = 1; step <= 5; step++) await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [{ x: start + (side === 'left' ? 1 : -1) * step * 25, y }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

for (const enlarged of [false, true]) test(`mobile home retains pages and supports edge navigation ${enlarged}`,
  async ({ page }, info) => {
    await page.setViewportSize({ width: enlarged ? 360 : 390, height: 844 });
    await page.addInitScript(enlarged => {
      localStorage.setItem('codex-switch.web.theme.v1', enlarged ? 'dark' : 'light');
      localStorage.setItem('codex-switch:global-font-size', enlarged ? '20' : '14');
    }, enlarged);
    await page.route('**/preview-site/page', route => route.fulfill({ contentType: 'text/html',
      body: '<h1>Website preview</h1><input aria-label="draft" value="original">' }));
    await page.goto('e2e/mobile-chat-browser-harness.html');
    const browser = page.locator('.browser-main-page');
    const home = browser.locator('.pm-browser-page:visible .browser-home');
    const prefix = `web-mobile-${enlarged ? 'dark-20px' : 'light-14px'}`;
    await page.locator('nav').getByRole('button', { name: '浏览器', exact: true }).click();
    await expect(home).toBeVisible();
    await expect(home).toContainText('打开喜欢的网页后');
    await expect(home).toContainText('手机网页暂不支持本地端口映射');
    expect(await home.evaluate(element => getComputedStyle(element).color))
      .toBe(await browser.evaluate(element => getComputedStyle(element).color));
    await expect(browser.getByRole('button', { name: /^(后退|前进)$/ })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`${prefix}-home-empty.png`) });
    await page.locator('nav').getByRole('button', { name: '聊天', exact: true }).click();
    await page.getByRole('link', { name: '网页链接', exact: true }).click();
    const frame = browser.locator('.pm-browser-page:visible iframe');
    await frame.contentFrame().getByRole('textbox').fill('retained draft');
    await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
    await page.getByRole('button', { name: '添加书签', exact: true }).click();
    await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
    await expect(page.locator('.browser-bookmark-settings-popup')).toBeHidden();
    await browser.getByRole('button', { name: '浏览器首页', exact: true }).click();
    await expect(home.getByRole('button', { name: /page.*127|page.*localhost/ })).toBeVisible();
    await expect(browser.locator('.pm-browser-page')).toHaveCount(2);
    await page.screenshot({ path: info.outputPath(`${prefix}-home-bookmarks.png`) });
    await swipe(page, 'left');
    await expect(frame.contentFrame().getByRole('textbox')).toHaveValue('retained draft');
    await swipe(page, 'left'); await expect(home).toBeVisible();
    await swipe(page, 'right'); await expect(browser).toBeHidden();
    await page.screenshot({ path: info.outputPath(`${prefix}-left-swipe-exit.png`) });
    await page.locator('nav').getByRole('button', { name: '浏览器', exact: true }).click();
    await home.locator('.browser-home-link').click();
    await expect(frame.contentFrame().getByRole('textbox')).toHaveValue('retained draft');
    await browser.getByRole('button', { name: '新标签页', exact: true }).click();
    await expect(home).toBeVisible();
    await expect(browser.locator('.pm-browser-page')).toHaveCount(3);
    await swipe(page, 'left'); await expect(browser).toBeHidden();
  });
