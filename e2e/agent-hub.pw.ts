import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { connect, login } from './chat-helpers';

for (const large of [false, true]) {
  test(`Agent Hub Web navigation ${large ? 'dark enlarged narrow' : 'light default'}`, async ({ page }) => {
    await page.setViewportSize({ width: large ? 1024 : 1440, height: 900 });
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    await page.addInitScript(large => {
      localStorage.setItem('codex-switch.web.theme.v1', large ? 'dark' : 'light');
      localStorage.setItem('codex-switch:global-font-size', large ? '20' : '14');
    }, large);
    await login(page);
    const navigation = page.locator('.desktop-sidebar nav');
    await expect(navigation.getByText('Agent Hub', { exact: true })).toBeVisible();
    await connect(page);
    await expect(page.locator('.chat-sidebar-heading strong')).toHaveText('Agent Hub');
    await expect(page.locator('.chat-thread-filter')).toHaveCSS('white-space', 'nowrap');
    await expect(page.locator('.adm-toast-mask')).toHaveCount(0);
    await expect(page.locator('.cli-gui-engine:visible')).toContainText('0.155.0');
    const input = page.getByRole('textbox', { name: '聊天消息' });
    await input.fill('保留草稿 Focus draft');
    await navigation.getByText('设置', { exact: true }).click();
    await navigation.getByText('Agent Hub', { exact: true }).click();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('保留草稿 Focus draft');
    const evidence = resolve('../../.codex-tmp/agent-hub-focus');
    await mkdir(evidence, { recursive: true });
    const prefix = `web-app-${large ? 'dark-large-narrow' : 'light-default'}`;
    await page.screenshot({ path: resolve(evidence, `${prefix}-menu.png`), animations: 'disabled' });
    await page.locator('.cli-gui-engine:visible').focus();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(input).toBeFocused();
    await page.screenshot({ path: resolve(evidence, `${prefix}-activation.png`),
      animations: 'disabled' });
  });
}
