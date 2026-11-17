import { expect, test } from '@playwright/test';

const sources = ['C:/images/first.png', 'C:/images/second.png', 'C:/images/third.png'];
for (const settings of [
  { width: 390, height: 844, dark: false, font: 14 },
  { width: 320, height: 740, dark: true, font: 24 },
  { width: 844, height: 390, dark: false, font: 14 },
]) {
  test(`mobile web ${settings.width}x${settings.height} font ${settings.font}`, async ({ page }, info) => {
    await page.setViewportSize(settings);
    await page.addInitScript(size => localStorage.setItem('codex-switch:global-font-size', String(size)), settings.font);
    const images = await page.evaluate(() => ['#164f49', '#1b4561', '#55417d'].map((color, index) => {
      const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 1080;
      const context = canvas.getContext('2d')!;
      context.fillStyle = color; context.fillRect(0, 0, 720, 1080);
      context.strokeStyle = '#fff'; context.strokeRect(40, 40, 640, 1000);
      context.fillStyle = '#fff'; context.font = '54px sans-serif';
      context.fillText(`Image ${index + 1} / 3`, 86, 200);
      context.font = '25px sans-serif'; context.fillText('Remote AI - mobile preview', 86, 250);
      context.fillStyle = '#ffffff22';
      for (let row = 0; row < 3; row++) context.fillRect(86, 360 + row * 190, 548, 140);
      return canvas.toDataURL();
    }));
    await page.route('**/image-navigation-fixture', route => route.fulfill({ json: [{ id: 'turn',
      status: 'completed', items: [{ id: 'sent', type: 'userMessage', status: 'completed',
        content: [{ type: 'localImage', path: sources[0] }] },
      { id: 'reply', type: 'agentMessage', status: 'completed',
        text: `![Image 2](${sources[1]})\n\n![Image 3](${sources[2]})` }] }] }));
    await page.route('**/image-navigation-image', route => route.fulfill({
      json: { url: images[sources.indexOf(route.request().postData()!)] },
    }));
    await page.goto(`e2e/mobile-image-navigation-harness.html${settings.dark ? '?dark' : ''}`);
    await page.getByRole('button', { name: '放大查看：Image 3', exact: true }).tap();
    const image = page.locator('.cs-image-stage img');
    const previous = page.locator('.cs-image-previous');
    const next = page.locator('.cs-image-next');
    await expect(image).toHaveAttribute('src', images[2]);
    await expect(next).toBeDisabled();
    for (const arrow of [previous, next]) {
      const box = (await arrow.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(settings.width);
      expect(Math.abs(box.y + box.height / 2 - settings.height / 2)).toBeLessThan(1);
    }
    await page.screenshot({ path: info.outputPath('web-mobile-last.png') });
    await previous.tap();
    await expect(image).toHaveAttribute('src', images[1]);
    await expect(previous).toBeEnabled(); await expect(next).toBeEnabled();
    await page.screenshot({ path: info.outputPath('web-mobile-middle.png') });
    await previous.tap();
    await expect(image).toHaveAttribute('src', images[0]);
    await expect(previous).toBeDisabled();
    await page.screenshot({ path: info.outputPath('web-mobile-first.png') });
    await next.tap();
    await expect(image).toHaveAttribute('src', images[1]);
    await page.locator('.cs-image-original').tap();
    await expect(page.locator('.cs-image-original')).toHaveCount(0);
    await next.tap();
    await expect(image).toHaveAttribute('src', images[2]);
    await expect(page.locator('.cs-image-original')).toBeVisible();
    await page.locator('.cs-image-close').tap();
    await expect(page.locator('.cs-image-viewer')).toHaveCount(0);
    await expect(page.getByLabel('draft')).toHaveValue('Keep this draft');
  });
}
