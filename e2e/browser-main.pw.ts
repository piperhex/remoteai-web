import { expect, test } from '@playwright/test';

for (const enlarged of [false, true]) test(`web desktop browser ${enlarged ? 'dark narrow enlarged' : 'light wide'}`,
  async ({ page }, info) => {
    await page.setViewportSize({ width: enlarged ? 900 : 1440, height: 900 });
    await page.context().route('https://preview.example.test/**', route => route.fulfill({ contentType: 'text/html',
      body: '<h1>Website preview</h1>' }));
    await page.route(/^https:\/\/fonts\./, route => route.abort());
    await page.goto(`e2e/web-browser-bookmarks-harness.html${enlarged ? '?dark=1&font=20' : ''}`,
      { waitUntil: 'domcontentloaded' });
    const browser = page.locator('.browser-main-page');
    const address = browser.getByLabel('页面地址', { exact: true });
    await address.fill('https://preview.example.test/guide'); await address.press('Enter');
    await expect(browser.locator('iframe').contentFrame().getByRole('heading')).toHaveText('Website preview');
    await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
    const settings = page.locator('.browser-bookmark-settings-popup');
    await expect(settings.getByRole('button', { name: '关闭', exact: true })).toHaveCount(0);
    await expect(settings.getByRole('checkbox', { name: '桌面版网站', exact: true })).toBeChecked();
    await expect(settings.getByRole('checkbox', { name: '桌面版网站', exact: true })).toBeDisabled();
    await settings.getByRole('button', { name: '添加书签', exact: true }).click();
    await expect(settings.getByRole('button', { name: '添加书签', exact: true })).toBeDisabled();
    const popupPromise = page.waitForEvent('popup');
    await settings.getByRole('button', { name: '在浏览器中打开', exact: true }).click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL('https://preview.example.test/guide'); await popup.close();
    expect((await settings.boundingBox())!.width).toBeLessThanOrEqual(400);
    const prefix = `web-desktop-${enlarged ? 'dark-20px-narrow' : 'light-14px'}`;
    await page.screenshot({ path: info.outputPath(`${prefix}-settings.png`), animations: 'disabled' });
    await settings.getByRole('button', { name: '端口映射', exact: true }).click();
    const mappings = page.getByRole('menu', { name: '端口映射', exact: true });
    await expect(mappings).toBeVisible();
    await expect(page.locator('.browser-settings-submenu-popup:visible')).not.toHaveClass(/-appear|-enter/);
    await expect(settings).toBeVisible();
    const bounds = await mappings.boundingBox(), parent = await settings.boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThan(parent!.x);
    await expect(mappings).toContainText('暂无可打开的端口映射');
    await expect(mappings).toContainText('本地端口供手机和电脑使用');
    await page.screenshot({ path: info.outputPath(`${prefix}-mappings-empty.png`), animations: 'disabled' });
    await settings.getByRole('button', { name: '所有书签', exact: true }).hover();
    const bookmarks = page.getByRole('menu', { name: '所有书签', exact: true });
    await expect(bookmarks).toBeVisible();
    await expect(mappings).toBeHidden();
    await expect(page.locator('.browser-settings-submenu-popup:visible')).not.toHaveClass(/-appear|-enter/);
    await expect(bookmarks.getByRole('menuitem').last()).toHaveText('管理书签');
    const bookmarkBounds = await bookmarks.boundingBox();
    expect(bookmarkBounds!.x + bookmarkBounds!.width).toBeLessThan(parent!.x);
    await page.screenshot({ path: info.outputPath(`${prefix}-bookmarks.png`), animations: 'disabled' });
    await bookmarks.getByRole('menuitem', { name: '管理书签', exact: true }).click();
    await expect(settings).toBeHidden();
    await expect(page.getByRole('dialog', { name: '管理书签', exact: true })).toBeVisible();
  });
