import { expect, test, type Page } from '@playwright/test';

const names = ['远程桌面', '终端', 'Git', '文件浏览'];
const menu = (page: Page) => page.locator('.chat-tools-menu:visible');
async function open(page: Page, name: string) {
  await page.getByRole('button', { name: '打开工具', exact: true }).click();
  await menu(page).getByRole('button', { name, exact: true }).click();
  await expect(menu(page)).toHaveCount(0);
}
async function status(page: Page, name: string, opened: boolean) {
  await page.getByRole('button', { name: '打开工具', exact: true }).click();
  await expect(menu(page).getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', String(opened));
  await page.getByRole('button', { name: '打开工具', exact: true }).click();
}

test('retains all four tools until X, shows green icons and restores their state', async ({ page }, info) => {
  await page.goto('e2e/remote-desktop-harness.html?retained-tools&touch');
  await open(page, '远程桌面');
  const desktop = page.locator('.rd-root');
  await expect.poll(() => page.evaluate(() => (window as unknown as { desktopTest: { frames: number } })
    .desktopTest.frames)).toBeGreaterThan(2);
  const media = () => page.evaluate(() => {
    const state = (window as unknown as { desktopTest: { captures: number; closed: number } }).desktopTest;
    return { captures: state.captures, closed: state.closed };
  });
  const baseline = await media();
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`${info.project.name}-desktop-open.png`) });
  await desktop.getByRole('button', { name: '最小化', exact: true }).click();
  await status(page, '远程桌面', true);
  await page.getByRole('button', { name: 'Toggle page', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle page', exact: true }).click();
  expect(await media()).toEqual(baseline);

  await open(page, '终端');
  const terminal = page.getByRole('dialog', { name: '远程终端', exact: true });
  // Wide viewports use the docked terminal; the retained hooks are the same in both layouts.
  const mobile = info.project.name !== 'desktop';
  const terminalPanel = mobile ? terminal : page.getByRole('region', { name: '终端', exact: true });
  await expect(page.locator('.xterm-rows')).toContainText('BACKGROUND_TERMINAL');
  const terminalNode = await page.locator('.xterm').elementHandle();
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`${info.project.name}-terminal-open.png`) });
  await terminalPanel.getByRole('button', { name: '收起终端', exact: true }).click();
  await status(page, '终端', true);

  await open(page, 'Git');
  const git = page.getByRole('dialog', { name: 'Git', exact: true });
  await git.getByRole('textbox', { name: '提交说明', exact: true }).fill('Retained commit draft');
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`${info.project.name}-git-open.png`) });
  await git.press('Escape');
  await status(page, 'Git', true);

  await open(page, '文件浏览');
  const files = page.getByRole('dialog', { name: '文件浏览', exact: true });
  await expect(files.getByText('README.md', { exact: true }).first()).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`${info.project.name}-files-open.png`) });
  await files.getByRole('button', { name: '最小化详情抽屉', exact: true }).click();
  await status(page, '文件浏览', true);
  await page.getByRole('button', { name: '打开工具', exact: true }).click();
  for (const name of names) {
    const item = menu(page).getByRole('button', { name, exact: true });
    await expect(item).toHaveAttribute('aria-pressed', 'true');
    const rgb = (await item.locator('svg').evaluate(element => getComputedStyle(element).color))
      .match(/\d+/g)!.map(Number);
    expect(rgb[1]).toBeGreaterThan(rgb[0]);
    expect(rgb[1]).toBeGreaterThan(rgb[2]);
  }
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`${info.project.name}-all-tools-open.png`) });
  await page.getByRole('button', { name: '打开工具', exact: true }).click();

  await open(page, 'Git');
  await expect(git.getByRole('textbox', { name: '提交说明', exact: true })).toHaveValue('Retained commit draft');
  await git.getByRole('button', { name: mobile ? '关闭 Git' : '关闭详情抽屉', exact: true }).click();
  await status(page, 'Git', false);
  await open(page, '文件浏览');
  await files.getByRole('button', { name: '关闭详情抽屉', exact: true }).click();
  await status(page, '文件浏览', false);
  await open(page, '终端');
  expect(await terminalNode!.evaluate(node => node.isConnected)).toBe(true);
  await terminalPanel.getByRole('button', { name: '关闭', exact: true }).click();
  await status(page, '终端', false);
  await open(page, '远程桌面');
  expect(await media()).toEqual(baseline);
  await desktop.getByRole('button', { name: '关闭', exact: true }).click();
  await status(page, '远程桌面', false);
  await page.getByRole('button', { name: '打开工具', exact: true }).click();
  await expect(menu(page)).toBeVisible();
  for (const name of names) {
    await expect(menu(page).getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'false');
  }
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`${info.project.name}-tools-closed.png`) });
});

test('wide Web launchers retain green status and terminal X closes its panel', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('e2e/remote-desktop-harness.html?retained-tools&touch&wide-tools');
  await page.getByRole('button', { name: '打开远程桌面', exact: true }).click();
  await page.locator('.rd-root').getByRole('button', { name: '最小化', exact: true }).click();
  const desktop = page.locator('button[data-opened]');
  await expect(desktop).toHaveAttribute('data-opened', 'true');
  await page.getByRole('button', { name: '打开远程终端', exact: true }).click();
  const terminal = page.getByRole('region', { name: '终端', exact: true });
  await expect(terminal).toBeVisible();
  await terminal.getByRole('button', { name: '收起终端', exact: true }).click();
  const launcher = page.getByRole('button', { name: '打开远程终端', exact: true });
  for (const icon of [desktop.locator('svg'), launcher.locator('svg')]) {
    const rgb = (await icon.evaluate(element => getComputedStyle(element).color)).match(/\d+/g)!.map(Number);
    expect(rgb[1]).toBeGreaterThan(rgb[0]);
    expect(rgb[1]).toBeGreaterThan(rgb[2]);
  }
  await launcher.click();
  await page.screenshot({ animations: 'disabled', path: info.outputPath('desktop-wide-terminal-retained.png') });
  await terminal.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(terminal).toHaveCount(0);
});
