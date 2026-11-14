import { expect, test } from '@playwright/test';

for (const scenario of [{ name: 'light', size: 14, width: 1280 },
  { name: 'dark-enlarged-narrow', size: 20, width: 900, dark: true }]) {
  test(`Web ${scenario.name}: paginates, records and confirms the answer`, async ({ page }, info) => {
    const answers: string[][] = [];
    await page.route('**/question-answer', async route => {
      answers.push(route.request().postDataJSON()); await route.fulfill({ json: {} });
    });
    await page.route('**/question-dictation', async route => {
      const request = route.request().postDataJSON();
      if (request.action === 'transcribe') {
        expect(request.data.length).toBeGreaterThan(100);
        await route.fulfill({ json: { text: '请调整提示位置。' } });
      } else await route.fulfill({ json: { sessionId: 'web-recording' } });
    });
    await page.setViewportSize({ width: scenario.width, height: 900 });
    await page.addInitScript(size => localStorage.setItem('codex-switch:global-font-size', String(size)), scenario.size);
    await page.goto(`e2e/question-pager-harness.html?mode=web&options&multi${scenario.dark ? '&dark' : ''}`);
    const card = page.getByRole('region', { name: '问题', exact: true });
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS('font-size', `${scenario.size}px`);
    await card.screenshot({ path: info.outputPath(`web-${scenario.name}-first.png`), animations: 'disabled' });
    await card.getByRole('navigation').getByRole('button', { name: '下一题' }).click();
    await expect(card.getByText('2 / 2')).toBeVisible();
    await card.getByRole('button', { name: '语音输入', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: '正在录音' })).toContainText('0:01');
    await page.screenshot({ path: info.outputPath(`web-${scenario.name}-recording.png`) });
    await card.getByRole('button', { name: '结束录音并转写' }).click();
    await expect(page.getByRole('textbox')).toHaveValue('请调整提示位置。');
    await expect(page.locator('.ant-popover:visible')).toHaveCount(0);
    expect(answers).toHaveLength(0);
    expect(await card.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(false);
    await card.screenshot({ path: info.outputPath(`web-${scenario.name}-transcribed.png`), animations: 'disabled' });
    await card.getByRole('button', { name: '发送', exact: true }).click();
    await expect(card).toHaveCount(0);
    expect(answers).toEqual([['ZH2', '请调整提示位置。']]);
  });
}
