import { expect, type Page, type TestInfo } from '@playwright/test';

export async function verifyBrowserTabLoading(page: Page, info: TestInfo, entry: string) {
  await page.route('**/tab-loading/icon.svg', route => route.fulfill({ contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#e99423" d="M1 2h14L8 15z"/></svg>',
  }));
  await page.goto(entry, { waitUntil: 'domcontentloaded' });
  const url = new URL('/tab-loading/guide', page.url()).href;
  const document = { contentType: 'text/html; charset=utf-8',
    body: '<link rel="icon" href="/tab-loading/icon.svg"><title>使用指南</title><h1>使用指南</h1>' };
  await page.route(url, route => route.fulfill(document));
  const browser = page.locator('.browser-main-page');
  const address = browser.getByRole('combobox');
  await address.fill(url); await address.press('Enter');
  const tab = browser.getByRole('tab').first();
  const image = tab.locator('img');
  const ring = tab.locator('.pm-browser-tab-ring');
  await expect(tab).toHaveAccessibleName('使用指南');
  await expect(image).toHaveAttribute('data-loaded', 'true');
  await expect(tab.locator('.provider-website-icon')).toHaveCSS('transform', 'none');
  const width = () => image.evaluate(node => node.getBoundingClientRect().width);
  const originalWidth = await width();
  const title = tab.getByText('使用指南');
  const titlePosition = await title.boundingBox();
  const screenshot = (state: string) => browser.locator('.pm-browser-titlebar').screenshot({
    path: info.outputPath(`tab-strip-${state}.png`),
  });
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  await page.route(url, async route => { await pending; await route.fulfill(document); });
  try {
    await browser.getByRole('button', { name: '刷新', exact: true }).click();
    await expect(tab).toHaveAttribute('aria-busy', 'true');
    await expect(ring).toHaveCSS('animation-play-state', 'running');
    await expect(ring).not.toHaveCSS('animation-name', 'none');
    await expect.poll(width).toBeLessThan(originalWidth * .7);
    expect(await title.boundingBox()).toEqual(titlePosition);
    await screenshot('loading');
    await browser.getByRole('button', { name: '新标签页', exact: true }).click();
    await expect(ring).toBeVisible();
    await expect(browser.getByRole('tab', { selected: true })).toHaveAttribute('aria-busy', 'false');
    await screenshot('background-loading');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(ring).toHaveCSS('animation-name', 'none');
    await expect(ring.locator('circle')).toHaveCSS('animation-name', 'none');
    await tab.click();
  } finally { finish(); }
  await expect(tab).toHaveAttribute('aria-busy', 'false');
  await expect(ring).toHaveCount(0);
  await expect.poll(width).toBe(originalWidth);
  await screenshot('loaded');
}
