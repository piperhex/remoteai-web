import { expect, test, type Locator, type Page } from '@playwright/test';
import { connect, fixtureUrl, login, navigate, screenshot } from './chat-helpers';

async function longPress(page: Page, link: Locator) {
  const bounds = (await link.boundingBox())!;
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart',
    touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] });
  await expect(page.getByRole('menu')).toBeVisible();
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}

const url = 'https://chat-link.example.test/guide';
for (const enlarged of [false, true]) test(`chat link destinations ${enlarged ? 'dark enlarged' : 'light'}`,
  async ({ page, request }, info) => {
    test.skip(info.project.name !== 'desktop', 'Desktop conversation browser destinations');
    await page.setViewportSize({ width: enlarged ? 1000 : 1440, height: 900 });
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(({ enlarged }) => {
      localStorage.setItem('codex-switch:global-font-size', enlarged ? '20' : '14');
      localStorage.setItem('codex-switch.web.theme.v1', enlarged ? 'dark' : 'light');
    }, { enlarged });
    await page.context().route('https://chat-link.example.test/**', route => route.fulfill({
      contentType: 'text/html', body: '<h1>Chat link preview</h1>',
    }));
    await request.post(`${fixtureUrl}/test/reset`);
    await login(page); await connect(page);
    await page.getByRole('button', { name: '移动端聊天体验', exact: true }).click();
    await expect(page.getByRole('heading', { name: '移动端聊天体验', exact: true })).toBeVisible();
    await request.post(`${fixtureUrl}/test/chat-event`, { data: { method: 'turn/started', params: {
      threadId: 'demo-chat', turn: { id: 'website-links', status: 'inProgress', items: [
        { id: 'website-link', type: 'agentMessage', phase: 'final_answer', text: `[使用指南](${url})` },
      ] },
    } } });
    const link = page.getByRole('link', { name: '使用指南' });
    const menu = page.getByRole('menu');
    await link.click({ button: 'right' });
    await expect(menu.getByRole('menuitem')).toHaveText(['右侧边浏览器', '独立内置浏览器', '外部浏览器', '复制链接']);
    await expect(menu.getByRole('menuitem').first()).toHaveCSS('font-size', enlarged ? '20px' : '14px');
    const bounds = (await menu.boundingBox())!;
    expect(bounds.width).toBeLessThanOrEqual(400);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await screenshot(page, info, 'web-desktop-right-click-menu');
    await menu.getByRole('menuitem', { name: '复制链接' }).click();
    await expect(menu).toBeHidden();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(url);
    await longPress(page, link);
    await expect(menu.getByRole('menuitem')).toHaveCount(4);
    await expect(page.locator('.website-preview-browser')).toHaveCount(0);
    await screenshot(page, info, 'web-desktop-long-press-menu');
    await menu.getByRole('menuitem', { name: '右侧边浏览器' }).click();
    await expect(page.locator('.pm-browser-page:visible iframe').contentFrame()
      .getByRole('heading', { name: 'Chat link preview' })).toBeVisible();
    await screenshot(page, info, 'web-desktop-sidebar-browser');
    await page.getByRole('button', { name: '关闭详情抽屉' }).click();
    await link.click({ button: 'right' });
    await menu.getByRole('menuitem', { name: '独立内置浏览器' }).click();
    await expect(page.locator('.browser-main-page .pm-browser-page:visible iframe').contentFrame()
      .getByRole('heading', { name: 'Chat link preview' })).toBeVisible();
    await screenshot(page, info, 'web-desktop-standalone-browser');
    await navigate(page, '聊天'); await link.click({ button: 'right' });
    const popupPromise = page.waitForEvent('popup');
    await menu.getByRole('menuitem', { name: '外部浏览器' }).click();
    const popup = await popupPromise; await expect(popup).toHaveURL(url); await popup.close();
  });
