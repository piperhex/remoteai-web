import { expect, type Page, type TestInfo } from '@playwright/test';

const titles = ['项目文档与常用工具', '使用指南', '设计规范', '会议记录', '团队周报', '更新日志', '邮箱'];
const linkActions = ['在新标签页中打开', '编辑书签', '删除', '管理书签'];

async function seedBookmarks(page: Page, scope: string) {
  await page.addInitScript(({ scope, titles }) => {
    const folders = [
      { id: 'work', title: '工作', parentId: '', position: 0 },
      { id: 'team', title: '团队资料', parentId: 'work', position: titles.length },
    ].map(folder => ({ ...folder, kind: 'folder', url: '' }));
    const links = folders.flatMap(folder => titles.map((title, position) => ({
      id: folder.id + position, title, position, parentId: folder.id, kind: 'link',
      url: `https://example.test/${folder.id}/${position}`,
    })));
    localStorage.setItem(`remoteai:browser-bookmarks:${scope}`, JSON.stringify({
      document: { revision: 0, entries: [...folders, ...links] },
    }));
  }, { scope, titles });
}

async function verifyActions(page: Page, info: TestInfo, label: string, folder: string) {
  const edit = page.getByRole('menuitem', { name: '编辑书签', exact: true });
  const menu = page.getByRole('menu').filter({ has: edit });
  await expect(menu.getByRole('menuitem')).toHaveText(linkActions);
  await expect(menu.locator('..')).not.toHaveClass(/-appear|-enter/);
  // Hit-test the overlapping edge of every action. Visibility alone passes for covered menus.
  for (const item of await menu.getByRole('menuitem').all()) {
    await expect(item).toBeInViewport();
    expect(await item.evaluate(el => {
      const box = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(box.left + 3, box.top + box.height / 2));
    })).toBe(true);
  }
  const browser = await page.locator('.pm-browser').boundingBox();
  if (!browser) throw new Error('Missing browser panel');
  await page.screenshot({ path: info.outputPath(`${label}.png`), animations: 'disabled',
    clip: { ...browser, width: Math.min(browser.width, 740), height: Math.min(browser.height, 640) } });
  await edit.click({ position: { x: 3, y: 10 } });
  const dialog = page.getByRole('dialog', { name: '编辑书签', exact: true });
  await expect(dialog.getByRole('textbox', { name: '名称' })).toHaveValue(titles[1]);
  await expect(dialog.getByRole('textbox', { name: '页面地址' })).toHaveValue(`https://example.test/${folder}/1`);
  await dialog.getByRole('button', { name: /取\s*消/ }).click();
  await expect(page.getByRole('combobox', { name: '页面地址' })).toHaveValue('');
}

export async function verifyBookmarkContextMenu(page: Page, info: TestInfo, options: {
  scope: string; harness: string; label: string;
}) {
  await seedBookmarks(page, options.scope);
  await page.setViewportSize({ width: options.harness.includes('dark') ? 980 : 1280, height: 800 });
  await page.goto(options.harness, { waitUntil: 'domcontentloaded' });
  const work = page.getByRole('button', { name: '工作', exact: true });
  await work.click();
  const guide = page.getByRole('menuitem', { name: titles[1], exact: true });
  const guideWidth = await guide.evaluate(el => el.clientWidth);
  await guide.click({ button: 'right', position: { x: guideWidth / 2, y: 1 } });
  await verifyActions(page, info, `${options.label}-folder-right-click`, 'work');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await work.click();
  await page.getByRole('menuitem', { name: '团队资料' }).hover();
  const nested = page.getByRole('menuitem').filter({ has: page.locator('[data-path="team1"]') });
  await nested.hover();
  await expect(page.locator('.ant-dropdown-menu-submenu-popup:visible')).not.toHaveClass(/-appear|-enter/);
  const icon = await nested.locator('.ant-dropdown-menu-item-icon').boundingBox();
  if (!icon) throw new Error('Missing nested bookmark icon');
  const touch = await page.context().newCDPSession(page);
  try {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
      { x: icon.x + icon.width / 2, y: icon.y + icon.height / 2 },
    ] });
    await expect(page.getByRole('menuitem', { name: linkActions[0] })).toBeVisible();
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await touch.detach(); }
  await verifyActions(page, info, `${options.label}-subfolder-long-press`, 'team');
}
