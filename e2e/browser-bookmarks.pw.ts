import { expect, test } from '@playwright/test';
import { verifyBookmarkOverflow } from '../../../shared/testing/bookmarkOverflow.mts';
import { verifyBookmarkFolders } from '../../../shared/testing/bookmarkFolders.mts';

test('web bookmark folder creation and drops', async ({ page }, info) => {
  await verifyBookmarkFolders(page, info, { label: 'web-desktop',
    harness: 'e2e/web-browser-bookmarks-harness.html' });
});

test('web bookmark overflow follows the sidebar width', async ({ page }, info) => {
  await verifyBookmarkOverflow(page, info, { scope: 'web-bookmarks', label: 'web-desktop',
    harness: 'e2e/web-browser-bookmarks-harness.html?sidebar=1' });
});

for (const enlarged of [false, true]) {
  test(`web bookmarks ${enlarged ? 'dark narrow enlarged' : 'light wide'}`, async ({ page }, info) => {
    await page.setViewportSize({ width: enlarged ? 1000 : 1440, height: 900 });
    await page.route(/^https:\/\/(fonts\.|example\.test)/, route => route.fulfill({ contentType: 'text/html',
      body: '<body style="padding:32px;font:16px system-ui"><h1>Remote AI</h1><p>Browser preview</p></body>' }));
    const theme = enlarged ? '?dark=1&font=20' : '?font=14';
    await page.goto(`e2e/web-browser-bookmarks-harness.html${theme}`, { waitUntil: 'domcontentloaded' });
    const browser = page.locator('.pm-browser');
    const address = browser.getByLabel('页面地址', { exact: true });
    await address.fill('https://example.test/guide'); await address.press('Enter');
    await browser.getByRole('button', { name: '添加书签', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '编辑书签', exact: true });
    await editor.getByRole('textbox', { name: '名称' }).fill('使用指南');
    await expect(page.locator('.ant-modal:visible')).not.toHaveClass(/-appear|-enter/);
    await page.screenshot({ path: info.outputPath(`web-${enlarged ? 'dark-20px' : 'light-14px'}-editor.png`) });
    await editor.getByRole('button', { name: /保\s*存/ }).click();
    await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
    const toggle = page.getByRole('switch', { name: '显示书签栏' });
    await expect(toggle).toBeVisible();
    await expect(page.locator('.browser-bookmark-settings-popup:visible')).not.toHaveClass(/-appear|-enter/);
    await page.screenshot({ path: info.outputPath(`web-${enlarged ? 'dark-20px' : 'light-14px'}-settings.png`) });
    await toggle.click(); await expect(browser.getByRole('navigation', { name: '书签栏' })).toHaveCount(0);
    await page.goto(`e2e/web-browser-bookmarks-harness.html${theme}&sidebar=1`, { waitUntil: 'domcontentloaded' });
    await expect(browser.getByRole('navigation', { name: '书签栏' })).toHaveCount(0);
    await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
    await page.getByRole('switch', { name: '显示书签栏' }).click();
    await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
    await expect(browser.locator('.browser-bookmark-item').filter({ hasText: '使用指南' })).toBeVisible();
    await address.fill('https://example.test/second'); await address.press('Enter');
    await browser.getByRole('button', { name: '添加书签', exact: true }).click();
    await editor.getByRole('textbox', { name: '名称' }).fill('第二个书签');
    await editor.getByRole('button', { name: /保\s*存/ }).click();
    await expect(editor).toBeHidden();
    const bookmarks = browser.locator('.browser-bookmark-item');
    const source = await bookmarks.first().boundingBox(), target = await bookmarks.last().boundingBox();
    if (!source || !target) throw new Error('Bookmark drag targets are missing');
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width - 3, target.y + target.height / 2, { steps: 8 });
    await expect(bookmarks.last()).toHaveClass(/bookmark-drop-after/);
    await page.screenshot({ path: info.outputPath(`web-${enlarged ? 'dark-20px' : 'light-14px'}-drag.png`) });
    await page.mouse.up();
    await expect(bookmarks).toHaveText(['第二个书签', '使用指南']);
    await bookmarks.first().click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: '删除', exact: true })).toBeVisible();
      await expect(page.locator('.browser-bookmark-menu:visible')).not.toHaveClass(/-appear|-enter/);
    await page.screenshot({ path: info.outputPath(`web-${enlarged ? 'dark-20px' : 'light-14px'}-context-menu.png`) });
    await page.getByRole('menuitem', { name: '编辑书签' }).click();
    await editor.getByRole('textbox', { name: '名称' }).fill('已修改');
    await editor.getByRole('button', { name: /保\s*存/ }).click();
    await expect(editor).toBeHidden();
    await expect(page.getByRole('menuitem', { name: '删除', exact: true })).toBeHidden();
    await bookmarks.first().dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 1, isPrimary: true,
      button: 0, clientX: target.x, clientY: target.y });
    await expect(page.getByRole('menuitem', { name: '删除', exact: true })).toBeVisible();
      await expect(page.locator('.browser-bookmark-menu:visible')).not.toHaveClass(/-appear|-enter/);
    await bookmarks.first().dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 1, isPrimary: true, button: 0 });
    await page.getByRole('menuitem', { name: '删除', exact: true }).click();
    await expect(page.locator('.ant-modal:visible')).not.toHaveClass(/-appear|-enter/);
    await page.screenshot({ path: info.outputPath(`web-${enlarged ? 'dark-20px' : 'light-14px'}-delete.png`) });
    await page.getByRole('dialog', { name: '删除', exact: true }).getByRole('button', { name: /删\s*除/ }).click();
    await expect(bookmarks).toHaveText(['使用指南']);
    await page.screenshot({ path: info.outputPath(`web-${enlarged ? 'dark-20px' : 'light-14px'}-sidebar.png`) });
  });

  test(`web application browser navigation ${enlarged ? 'dark enlarged' : 'light'}`, async ({ page }, info) => {
    await page.setViewportSize({ width: enlarged ? 1000 : 1440, height: 900 });
    await page.addInitScript(large => {
      localStorage.setItem('codex-switch.web.language.v1', 'zh');
      localStorage.setItem('codex-switch.web.theme.v1', large ? 'dark' : 'light');
      localStorage.setItem('codex-switch:global-font-size', large ? '20' : '14');
      localStorage.setItem('codex-switch.web.session.v1', JSON.stringify({ baseUrl: `${location.origin}/bookmark-fixture`,
        email: 'bookmarks@example.test', accessToken: 'fixture', refreshToken: 'fixture' }));
    }, enlarged);
    await page.route('**/bookmark-fixture/**', route => route.fulfill({ json: {
      accounts: [], providers: [], devices: [], email: 'bookmarks@example.test', id: 'bookmarks',
    } }));
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    const nav = page.locator('.desktop-sidebar nav');
    await expect(nav.getByRole('button', { name: 'Agent Hub', exact: true })
      .locator('xpath=following-sibling::button[1]')).toHaveText('浏览器');
    await nav.getByRole('button', { name: '浏览器', exact: true }).click();
    const browser = page.locator('.browser-main-page');
    await expect(browser).toBeVisible();
    await expect(page.locator('.desktop-topbar')).toBeHidden();
    const box = await browser.boundingBox();
    expect(box?.height).toBeGreaterThan(800);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(901);
    await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
    await expect(page.getByRole('switch', { name: '显示书签栏' })).toBeVisible();
      await expect(page.locator('.browser-bookmark-settings-popup:visible')).not.toHaveClass(/-appear|-enter/);
    await expect(page.locator('.adm-toast-mask')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`web-app-${enlarged ? 'dark-20px' : 'light-14px'}-settings.png`) });
    await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
    await nav.getByRole('button', { name: '在线交流', exact: true }).click();
    await expect(browser).toBeHidden();
    await nav.getByRole('button', { name: '浏览器', exact: true }).click();
    await expect(browser).toBeVisible();
  });
}
