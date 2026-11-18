import { expect, type Page, type TestInfo } from '@playwright/test';

const titles = ['百度', 'ChatGPT', '项目文档', '设计资源', '开发者指南', '团队知识库', '更新日志', '工作书签'];
const folderId = 'work';
const nestedUrl = 'https://example.test/guide';

async function capturePanel(page: Page, info: TestInfo, label: string) {
  const browser = await page.locator('.pm-browser').boundingBox();
  if (!browser) throw new Error('Browser panel is missing');
  await page.screenshot({ path: info.outputPath(`${label}.png`),
    clip: { ...browser, height: Math.min(browser.height, 405) }, animations: 'disabled' });
}

export async function verifyBookmarkOverflow(page: Page, info: TestInfo, options: {
  scope: string; harness: string; label: string;
}) {
  await page.addInitScript(({ scope, titles, folderId, nestedUrl }) => {
    const entries = titles.map((title, position) => {
      const folder = position === titles.length - 1;
      return { id: folder ? folderId : String(position), title, parentId: '', position,
        kind: folder ? 'folder' : 'link', url: folder ? '' : `https://example.test/${position}` };
    });
    entries.push({ id: 'guide', title: '使用指南', parentId: folderId, position: 0, kind: 'link', url: nestedUrl });
    localStorage.setItem(`remoteai:browser-bookmarks:${scope}`, JSON.stringify({ document: { revision: 0, entries } }));
  }, { scope: options.scope, titles, folderId, nestedUrl });
  await page.route('https://example.test/**', route => route.fulfill({ body: '<title>Guide</title>' }));
  await page.setViewportSize({ width: 880, height: 680 });
  await page.goto(options.harness, { waitUntil: 'domcontentloaded' });
  const bar = page.getByRole('navigation', { name: '书签栏' });
  const more = bar.getByRole('button', { name: '更多操作' });
  const buttons = bar.locator('.browser-bookmark-item:visible');
  await expect(more).toBeVisible();
  await expect(bar.getByRole('button', { name: '所有书签' })).toBeVisible();
  await expect(bar.locator('.browser-bookmark-items')).toHaveCSS('overflow-x', 'clip');
  const visible = await buttons.allTextContents();
  expect(visible.length).toBeGreaterThan(0);
  expect(visible.length).toBeLessThan(titles.length);
  expect(visible).toEqual(titles.slice(0, visible.length));
  await capturePanel(page, info, `${options.label}-bar`);
  await more.press('Enter');
  const menu = page.getByRole('menu', { name: '更多操作' });
  await expect(menu.getByRole('menuitem')).toHaveText(titles.slice(visible.length));
  await expect(page.locator('.browser-bookmark-menu:visible')).not.toHaveClass(/-appear|-enter/);
  await capturePanel(page, info, `${options.label}-menu`);
  await page.setViewportSize({ width: 1920, height: 680 });
  await expect(more).toHaveCount(0);
  await expect(menu).toBeHidden();
  await expect(buttons).toHaveText(titles);
  await capturePanel(page, info, `${options.label}-wide`);
  await page.setViewportSize({ width: 880, height: 680 });
  await more.click();
  await menu.getByRole('menuitem', { name: '工作书签' }).hover();
  await page.getByRole('menuitem', { name: '使用指南' }).click();
  await expect(page.getByLabel('页面地址', { exact: true })).toHaveValue(nestedUrl);
}
