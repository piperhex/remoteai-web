import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

async function longPress(page: Page, target: Locator, menu: Locator) {
  const bounds = await target.boundingBox();
  if (!bounds) throw new Error('Folder is not visible');
  const touch = await page.context().newCDPSession(page);
  try {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    ] });
    await expect(menu).toBeVisible();
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await touch.detach(); }
}

async function verifyCreateSubfolder(page: Page, work: Locator, capture: (state: string) => Promise<Buffer>) {
  const create = page.getByRole('menuitem', { name: '新建文件夹', exact: true });
  const dialog = page.getByRole('dialog', { name: '书签文件夹', exact: true });
  const selected = dialog.locator('.ant-tree-node-selected');
  const name = dialog.getByRole('textbox', { name: '名称' });
  const save = dialog.getByRole('button', { name: /保\s*存/ });
  await work.click();
  const project = page.getByText('项目资料', { exact: true });
  await project.click({ button: 'right' });
  await create.click();
  await expect(selected).toHaveText('项目资料');
  await expect(name).toHaveValue('');
  await name.fill('会议记录');
  await expect(dialog).not.toHaveClass(/-appear|-enter/);
  await capture('new-subfolder');
  await save.click(); await expect(dialog).toBeHidden();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await work.click(); await project.hover();
  await expect(page.getByRole('menuitem', { name: /会议记录/ })).toBeVisible();
  await work.click();
  await longPress(page, work, create); await create.click();
  await expect(selected).toHaveText('工作');
  await dialog.getByText('稍后阅读', { exact: true }).click();
  await expect(selected).toHaveText('稍后阅读');
  await name.fill('周末'); await save.click(); await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: '稍后阅读', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: /周末/ })).toBeVisible();
}

export async function verifyAddPageToFolder(page: Page, info: TestInfo, options: {
  harness: string; scope: string; label: string;
}) {
  const key = `remoteai:browser-bookmarks:${options.scope}`;
  await page.addInitScript(key => {
    if (localStorage.getItem(key)) return;
    const folders = [['work', '工作', ''], ['project', '项目资料', 'work'], ['later', '稍后阅读', '']];
    localStorage.setItem(key, JSON.stringify({ document: { revision: 0,
      entries: folders.map(([id, title, parentId], position) => ({ id, title, parentId, position, kind: 'folder', url: '' })),
    } }));
  }, key);
  await page.setViewportSize({ width: options.harness.includes('dark') ? 980 : 1280, height: 800 });
  await page.route('https://example.test/**', route => route.fulfill({ contentType: 'text/html', body: '<title>项目手册</title>' }));
  await page.goto(options.harness, { waitUntil: 'domcontentloaded' });
  const address = page.getByRole('combobox', { name: '页面地址', exact: true });
  await address.fill('https://example.test/manual'); await address.press('Enter');
  const bar = page.getByRole('navigation', { name: '书签栏' });
  const work = bar.getByRole('button', { name: '工作', exact: true });
  const add = page.getByRole('menuitem', { name: '添加网页', exact: true });
  const menu = page.getByRole('menu').filter({ has: add });
  const dialog = page.getByRole('dialog', { name: '添加网页', exact: true });
  const selected = dialog.locator('.ant-tree-node-selected');
  const name = dialog.getByRole('textbox', { name: '名称' });
  const url = dialog.getByRole('textbox', { name: '页面地址' });
  const save = dialog.getByRole('button', { name: /保\s*存/ });
  const capture = (state: string) => page.screenshot({
    path: info.outputPath(`${options.label}-${state}.png`), animations: 'disabled',
  });
  await work.click({ button: 'right' });
  const order = ['添加网页', '新建文件夹', '编辑书签', '管理书签', '删除'];
  await expect(menu.getByRole('menuitem')).toHaveText(order);
  await expect(page.locator('.browser-bookmark-menu:visible')).not.toHaveClass(/-appear|-enter/);
  await capture('folder-menu');
  await add.click();
  await expect(selected).toHaveText('工作');
  await expect(name).not.toHaveValue('');
  await expect(url).toHaveValue('https://example.test/manual');
  await expect(dialog).not.toHaveClass(/-appear|-enter/);
  await capture('add-page');
  await name.fill('项目手册'); await save.click(); await expect(dialog).toBeHidden();
  await work.click();
  await expect(page.getByRole('menuitem', { name: '项目手册' })).toBeVisible();
  await page.getByText('项目资料', { exact: true }).click({ button: 'right' });
  await add.click(); await expect(selected).toHaveText('项目资料');
  await dialog.getByText('稍后阅读', { exact: true }).click();
  await expect(selected).toHaveText('稍后阅读');
  await name.fill('阅读清单'); await url.fill('https://example.test/reading');
  await capture('choose-folder');
  await save.click(); await expect(dialog).toBeHidden();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await bar.getByRole('button', { name: '稍后阅读', exact: true }).click();
  await page.getByRole('menuitem', { name: '阅读清单' }).click();
  await expect(address).toHaveValue('https://example.test/reading');
  await longPress(page, work, add);
  await expect(menu.getByRole('menuitem')).toHaveText(order);
  await add.click(); await expect(selected).toHaveText('工作');
  await dialog.getByText('书签栏', { exact: true }).click();
  await expect(selected).toHaveText('书签栏');
  await dialog.getByRole('button', { name: /取\s*消/ }).click(); await expect(dialog).toBeHidden();
  await expect(bar.locator('.browser-bookmark-item')).toHaveCount(2);
  await verifyCreateSubfolder(page, work, capture);
}
