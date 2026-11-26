import { expect, type Page, type TestInfo } from '@playwright/test';

export async function verifyBrowserTabTitles(page: Page, info: TestInfo, entry: string, label: string) {
  await page.route('**/preview-site/**', route => {
    const title = new URL(route.request().url()).search ? '行李规定_搜索' : '出行指南';
    return route.fulfill({ contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><title>${title}</title><h1>${title}</h1>` });
  });
  await page.goto(entry);
  await page.getByRole('link', { name: '使用指南' }).click();
  const browser = page.locator('.website-preview-browser');
  const tabs = browser.getByRole('tab');
  await expect(tabs.first()).toHaveAccessibleName('出行指南');
  const url = new URL('/preview-site/guide', page.url());
  const guide = page.frame({ url: url.href })!;
  await browser.getByRole('button', { name: '新标签页', exact: true }).click();
  const address = browser.getByLabel('页面地址', { exact: true });
  await address.fill(url.href + '?q=luggage'); await address.press('Enter');
  await expect(tabs.nth(1)).toHaveAccessibleName('行李规定_搜索');
  await guide.evaluate(() => { document.title = '出行指南（更新）'; });
  await expect(tabs.first()).toHaveAccessibleName('出行指南（更新）');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.nth(1)).toHaveAccessibleName('行李规定_搜索');
  await browser.screenshot({ path: info.outputPath(`${label}-document-titles.png`) });
  await guide.evaluate(() => { document.querySelector('title')?.remove(); });
  await expect(tabs.first()).toHaveAccessibleName(`guide · ${url.hostname}`);
  // An embedded cross-origin page has a title that the host cannot read.
  await address.fill('https://docs.example.test/preview-site/guide'); await address.press('Enter');
  await expect(tabs.nth(1)).toHaveAccessibleName('guide · docs.example.test');
}
