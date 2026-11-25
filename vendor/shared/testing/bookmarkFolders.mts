import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

async function point(locator: Locator, fraction = 0.5) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Bookmark interaction target is missing');
  return { x: box.x + box.width * fraction, y: box.y + box.height / 2 };
}

async function dragToFolder(page: Page, source: Locator, folder: Locator) {
  const start = await point(source), end = await point(folder);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await expect(folder).toHaveClass(/bookmark-drop-inside/);
}

export async function verifyBookmarkFolders(page: Page, info: TestInfo, options: {
  harness: string; label: string;
}) {
  const narrow = options.harness.includes('dark');
  await page.setViewportSize({ width: narrow ? 980 : 1280, height: 750 });
  await page.route('https://example.test/**', route => route.fulfill({ contentType: 'text/html',
    body: '<html><title>设计手册</title></html>' }));
  await page.goto(options.harness, { waitUntil: 'domcontentloaded' });
  const bar = page.getByRole('navigation', { name: '书签栏' });
  const blank = await point(bar.locator('.browser-bookmark-background'), 0.55);
  const newFolder = page.getByRole('menuitem', { name: '新建文件夹', exact: true });
  const capture = (state: string) => page.screenshot({ path: info.outputPath(`${options.label}-${state}.png`),
    clip: { x: 0, y: 0, width: narrow ? 980 : 1280, height: 330 }, animations: 'disabled' });
  await page.mouse.click(blank.x, blank.y, { button: 'right' });
  await expect(newFolder).toBeVisible();
  await expect(page.locator('.browser-bookmark-menu:visible')).not.toHaveClass(/-appear|-enter/);
  await capture('new-folder');
  await newFolder.click();
  const dialog = page.getByRole('dialog', { name: '书签文件夹' });
  await dialog.getByRole('textbox', { name: '名称' }).fill('项目资料');
  await dialog.getByRole('button', { name: /保\s*存/ }).click();
  const folder = bar.getByRole('button', { name: '项目资料', exact: true });
  await expect(folder).toBeVisible();

  const address = page.getByLabel('页面地址', { exact: true });
  await address.fill('https://example.test/guide'); await address.press('Enter');
  await page.getByRole('button', { name: '添加书签', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '编辑书签' });
  await editor.getByRole('textbox', { name: '名称' }).fill('使用指南');
  await editor.getByRole('button', { name: /保\s*存/ }).click();
  const link = bar.getByRole('button', { name: '使用指南', exact: false });
  await expect(link).toBeVisible();
  await dragToFolder(page, link, folder);
  await capture('drag-bookmark');
  await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(link).toBeVisible();
  await dragToFolder(page, link, folder); await page.mouse.up();
  await expect(link).toHaveCount(0);

  await address.fill('https://example.test/design'); await address.press('Enter');
  const tab = page.getByRole('tab').first();
  await page.getByRole('button', { name: '新标签页', exact: true }).click();
  await dragToFolder(page, tab, folder);
  await capture('drag-tab');
  await page.mouse.up();
  await expect(tab).toHaveAttribute('aria-selected', 'false');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await folder.click();
  const contents = page.locator('.browser-bookmark-menu:visible').getByRole('menuitem');
  await expect(contents).toHaveCount(2);
  await expect(contents.first()).toHaveText('使用指南');
  await expect(page.locator('.browser-bookmark-menu:visible')).not.toHaveClass(/-appear|-enter/);
  await capture('folder-contents');
  await contents.last().click();
  await expect(address).toHaveValue('https://example.test/design');

  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [blank] });
  await expect(newFolder).toBeVisible();
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await newFolder.click(); await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /取\s*消/ }).click();
  await expect(bar.locator('.browser-bookmark-item')).toHaveCount(1);
}
