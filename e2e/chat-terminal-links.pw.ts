import { expect, test } from '@playwright/test';
import { connect, fixtureUrl, login, navigate, screenshot } from './chat-helpers';
import { openChatTool } from './chat-tool-actions';
import { clickTerminalLink } from '../../desktop/e2e/terminal-link-actions';

const url = 'https://terminal.example.test/preview';
const title = 'Terminal website';

for (const enlarged of [false, true]) test(`desktop terminal link destinations ${enlarged ? 'dark enlarged' : 'light'}`,
  async ({ page, request }, info) => {
    test.skip(info.project.name !== 'desktop', 'Desktop terminal browser destinations');
    await page.setViewportSize({ width: enlarged ? 1000 : 1440, height: 900 });
    await page.addInitScript(({ enlarged }) => {
      localStorage.setItem('codex-switch:global-font-size', enlarged ? '20' : '14');
      localStorage.setItem('codex-switch.web.theme.v1', enlarged ? 'dark' : 'light');
    }, { enlarged });
    await page.context().route('https://terminal.example.test/**', route => route.fulfill({
      contentType: 'text/html', body: `<h1>${title}</h1>`,
    }));
    await request.post(`${fixtureUrl}/test/reset`);
    await login(page); await connect(page); await openChatTool(page, '终端');
    await page.locator('.xterm-helper-textarea').fill(`\r\n${url}\r\n`);
    const menu = page.getByRole('dialog', { name: '打开终端链接', exact: true });
    await clickTerminalLink(page, url);
    await expect(menu.getByRole('button')).toHaveText(['右侧边浏览器', '独立内置浏览器', '外部浏览器']);
    await expect(menu).toHaveCSS('font-size', enlarged ? '20px' : '14px');
    if (enlarged) await expect(menu).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
    const bounds = (await menu.boundingBox())!;
    expect(bounds.width).toBeLessThanOrEqual(400);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
    await screenshot(page, info, 'web-desktop-terminal-link-menu');
    await menu.getByRole('button', { name: '右侧边浏览器' }).click();
    const sidebar = page.locator('.pm-browser-page:visible iframe').contentFrame();
    await expect(sidebar.getByRole('heading', { name: title })).toBeVisible();
    await screenshot(page, info, 'web-desktop-sidebar-browser');
    await page.getByRole('button', { name: '关闭详情抽屉' }).click();
    await clickTerminalLink(page, url);
    await menu.getByRole('button', { name: '独立内置浏览器' }).click();
    const browser = page.locator('.browser-main-page');
    await expect(browser.locator('.pm-browser-page:visible iframe').contentFrame()
      .getByRole('heading', { name: title })).toBeVisible();
    await screenshot(page, info, 'web-desktop-standalone-browser');
    await navigate(page, '聊天');
    await clickTerminalLink(page, url);
    const popupPromise = page.waitForEvent('popup');
    await menu.getByRole('button', { name: '外部浏览器' }).click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(url);
    await popup.close();
    // Private remote addresses remain blocked on Web when no forwarding transport is available.
    await page.getByRole('button', { name: '新建终端', exact: true }).click();
    await page.locator('.xterm-helper-textarea:visible').fill('http://localhost:3002/');
    for (const label of ['右侧边浏览器', '独立内置浏览器', '外部浏览器']) {
      await clickTerminalLink(page, 'http://localhost:3002/');
      await menu.getByRole('button', { name: label }).click();
      await expect(menu.getByRole('alert')).toContainText('请在桌面端打开远程电脑的网页');
      await screenshot(page, info, `web-desktop-unavailable-${label}`);
      await page.keyboard.press('Escape');
    }
  });
