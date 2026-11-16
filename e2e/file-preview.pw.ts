import { expect, test, type Page } from '@playwright/test';
import { externalCodePath, longMarkdown, markdown, sourceCode } from './file-preview-fixture';
import { screenshot } from './chat-helpers';
import { readFile } from 'node:fs/promises';
import { dragSheet } from './sheet-drag';

const HTML_FIXTURE_PATH = 'F:/preview test/页面/index.html';

test('HTML image links open the original and return to the same document', async ({ page }, info) => {
  await page.goto(`e2e/file-preview-harness.html?assets&delay=700&path=${encodeURIComponent(HTML_FIXTURE_PATH)}`);
  const frame = page.frameLocator('.chat-html-frame');
  await expect(frame.locator('#loaded')).toHaveText('资源加载成功');
  await frame.getByRole('button', { name: '保留预览状态' }).click();
  await frame.getByAltText('相邻图片').click();
  const viewer = page.getByRole('dialog', { name: '相邻图片' });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByText('正在加载原图…', { exact: true })).toBeVisible();
  await page.screenshot({ path: `../../.codex-tmp/html-links-web-${info.project.name}-loading.png` });
  await expect(viewer.locator('img')).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => viewer.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(640);
  await viewer.getByRole('button', { name: '放大图片', exact: true }).click();
  await page.screenshot({ path: `../../.codex-tmp/html-links-web-${info.project.name}-opened.png` });
  await viewer.getByRole('button', { name: '关闭图片', exact: true }).click();
  await expect(viewer).toHaveCount(0);
  await expect(frame.getByRole('button', { name: '已点击' })).toBeVisible();
  await expect(frame.locator('#photo')).toHaveAttribute('src', /^data:image\/svg\+xml/);
  await page.screenshot({ path: `../../.codex-tmp/html-links-web-${info.project.name}-returned.png` });
});

test('HTML assets show loading placeholders before remote images are ready', async ({ page }, info) => {
  await page.goto(`e2e/file-preview-harness.html?assets&delay=1800&path=${encodeURIComponent(HTML_FIXTURE_PATH)}`);
  const frame = page.frameLocator('.chat-html-frame');
  const photo = frame.locator('#photo');
  await expect(photo).toHaveAttribute('aria-busy', 'true');
  await expect(photo).toHaveAttribute('src', /^data:image\/svg\+xml/);
  await expect(page.getByRole('status').filter({ hasText: '正在加载图片' })).toBeVisible();
  expect(await photo.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBe(320);
  await page.screenshot({ path: `../../.codex-tmp/html-assets-web-${info.project.name}-loading.png` });
  await expect(frame.locator('#loaded')).toHaveText('资源加载成功');
  await expect(photo).not.toHaveAttribute('aria-busy', 'true');
  expect(await photo.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBe(640);
  await expect(frame.locator('body')).toHaveCSS('background-color', 'rgb(245, 247, 246)');
  await frame.getByRole('button', { name: '保留预览状态' }).click();
  await expect(frame.getByRole('button', { name: '已点击' })).toBeVisible();
  await page.screenshot({ path: `../../.codex-tmp/html-assets-web-${info.project.name}-ready.png` });
  await page.getByRole('button', { name: '源码', exact: true }).click();
  await expect(page.locator('.chat-html-preview pre')).toContainText('images/preview%20image.svg');
});

test('HTML missing assets end loading and keep a readable document with a failure notice', async ({ page }) => {
  await page.goto(`e2e/file-preview-harness.html?assets&missing&path=${encodeURIComponent(HTML_FIXTURE_PATH)}`);
  await expect(page.getByRole('status').filter({ hasText: '部分' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '正在加载图片' })).toHaveCount(0);
  await expect(page.frameLocator('.chat-html-frame').getByRole('heading', { name: '相对资源预览' })).toBeVisible();
});

test('HTML keeps the loading image until a slow network image is decoded', async ({ page }) => {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/slow-photo.svg', async route => {
    await waiting;
    await route.fulfill({ contentType: 'image/svg+xml', body:
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360"/></svg>' });
  });
  await page.goto(`e2e/file-preview-harness.html?assets&external&path=${encodeURIComponent(HTML_FIXTURE_PATH)}`);
  const frame = page.frameLocator('.chat-html-frame');
  await expect(frame.locator('#photo')).toHaveAttribute('src', /^data:image\/svg\+xml,/);
  await expect(page.getByRole('status').filter({ hasText: '正在加载图片' })).toBeVisible();
  release();
  await expect(frame.locator('#loaded')).toHaveText('资源加载成功');
  await expect(page.getByRole('status').filter({ hasText: '正在加载图片' })).toHaveCount(0);
});

async function open(page: Page, path = 'verification.md') {
  await page.goto(`e2e/file-preview-harness.html?path=${encodeURIComponent(path)}`);
}
async function clipboard(page: Page) {
  return page.evaluate(async () => (await navigator.clipboard.readText()).replace(/\r\n/g, '\n'));
}

test('mobile previews open fullscreen with a compact header and download icon', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  await open(page, 'page.HTML');
  const sheet = page.locator('.chat-file-preview-sheet');
  const frame = page.locator('.chat-html-frame');
  await expect(frame).toBeVisible();
  await expect(sheet).toHaveClass(/mobile-popup-fullscreen/);
  expect((await sheet.boundingBox())!.height).toBeCloseTo(page.viewportSize()!.height, 0);
  const preview = (await frame.boundingBox())!;
  expect(preview.y).toBeLessThan(95);
  await expect(sheet.locator('.chat-markdown-preview-toolbar')).toHaveCount(0);
  const toggle = sheet.getByRole('button', { name: '源码', exact: true });
  await expect(toggle).toHaveText('');
  expect((await toggle.boundingBox())!.y).toBeLessThan(60);
  expect(preview.y + preview.height).toBeGreaterThan(page.viewportSize()!.height - 16);
  const download = sheet.getByRole('button', { name: '下载', exact: true });
  await expect(download).toBeVisible();
  await expect(download).toHaveText('');
  expect((await download.boundingBox())!.y).toBeLessThan(60);
  await expect(sheet.getByRole('button', { name: /全屏/ })).toHaveCount(0);
  await page.frameLocator('.chat-html-frame').locator('body').evaluate(node => { node.dataset.retained = 'yes'; });
  await dragSheet(page, 120, { target: page.locator('.sheet-header'), follows: false });
  await expect(sheet).toHaveClass(/mobile-popup-fullscreen/);
  await expect(page.frameLocator('.chat-html-frame').locator('body')).toHaveAttribute('data-retained', 'yes');
  await screenshot(page, info, 'html-fullscreen');
  await page.getByRole('button', { name: '源码', exact: true }).click();
  await expect(sheet.getByRole('button', { name: '预览', exact: true })).toHaveText('');
  await expect(page.locator('.chat-html-preview pre')).toContainText('<h1>页面预览</h1>');
  await expect(page.locator('.chat-html-preview pre')).toBeVisible();
  await expect(download).toBeVisible();
  await screenshot(page, info, 'html-fullscreen-source');
  await page.getByRole('button', { name: '预览', exact: true }).click();
  await expect(frame).toBeVisible();
  await page.setViewportSize({ width: 700, height: 390 });
  await expect(frame).toBeVisible();
  expect((await frame.boundingBox())!.height).toBeGreaterThan(100);
  await screenshot(page, info, 'html-fullscreen-landscape');
});

test('mobile Markdown and code remain scrollable in fullscreen', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  for (const path of ['long.md', 'source.ts']) {
    await open(page, path);
    await expect(page.locator('.chat-file-preview-sheet')).toHaveClass(/mobile-popup-fullscreen/);
    const content = page.locator('.adaptive-sheet-content');
    if (path.endsWith('.md')) {
      await content.evaluate(node => { node.scrollTop = node.scrollHeight; });
      expect(await content.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
      await page.getByRole('button', { name: '原文', exact: true }).click();
      const source = page.locator('pre');
      await source.evaluate(node => { node.scrollTop = node.scrollHeight; });
      expect(await source.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    }
    await expect(page.locator('pre')).toBeVisible();
    await expect(page.getByRole('button', { name: '下载', exact: true })).toBeAttached();
  }
});

test('mobile preview headers fit long filenames at default and enlarged fonts', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  await page.setViewportSize({ width: 320, height: 740 });
  for (const size of [14, 20]) {
    await page.addInitScript(fontSize => {
      localStorage.setItem('codex-switch:global-font-size', String(fontSize));
    }, size);
    await page.emulateMedia({ colorScheme: size === 14 ? 'light' : 'dark' });
    await open(page, externalCodePath.replace(/\.ts$/, '.html'));
    const title = page.locator('.sheet-header h2');
    await expect(title).toHaveText('legacyLinkFailures.test.html');
    if (size === 20) expect(await title.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
    const header = (await page.locator('.sheet-header').boundingBox())!;
    expect(header.height).toBeLessThan(70);
    const close = (await page.getByRole('button', { name: '关闭', exact: true }).boundingBox())!;
    expect(close.x + close.width).toBeLessThanOrEqual(320);
    await expect(page.frameLocator('.chat-html-frame').getByRole('heading', { name: '页面预览' })).toBeVisible();
    const toggle = page.getByRole('button', { name: '源码', exact: true });
    await expect(toggle).toHaveText('');
    await expect(page.locator('.chat-markdown-preview-toolbar')).toHaveCount(0);
    await screenshot(page, info, `compact-header-${size}px-${size === 14 ? 'light' : 'dark'}`);
    await toggle.click();
    await expect(page.locator('pre')).toHaveText('<h1>页面预览</h1>');
    await screenshot(page, info, `compact-source-${size}px-${size === 14 ? 'light' : 'dark'}`);
    await page.getByRole('button', { name: '预览', exact: true }).click();
    await expect(page.locator('.chat-html-frame')).toBeVisible();
  }
});

test('mobile download icons retain progress, cancel, save and error feedback', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  await page.goto('e2e/file-preview-harness.html?path=page.HTML&delay=600');
  await page.getByRole('button', { name: '下载', exact: true }).click();
  const progress = page.getByRole('progressbar', { name: '下载进度', exact: true });
  await expect(progress).toBeVisible();
  await expect.poll(() => progress.getAttribute('value')).toMatch(/^[1-9]/);
  await screenshot(page, info, 'compact-header-download-progress');
  await page.getByRole('button', { name: '取消下载', exact: true }).click();
  await expect(progress).toBeHidden();
  const saving = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载', exact: true }).click();
  const download = await saving;
  expect(download.suggestedFilename()).toBe('page.HTML');
  expect(await readFile((await download.path())!)).toEqual(Buffer.alloc(8 * 1024 * 1024, 'A'));
  await expect(page.locator('.chat-html-frame')).toBeVisible();
  await page.goto('e2e/file-preview-harness.html?path=page.HTML&download=error');
  await page.getByRole('button', { name: '下载', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('下载失败，请检查连接和存储空间后重试。');
  await screenshot(page, info, 'compact-header-download-error');
});

test('unsupported remote files show a download card and download-only context menus', async ({ page }, info) => {
  await page.goto('e2e/file-preview-harness.html?pc');
  for (const path of ['F:/remote/Remote AI.MSI', 'F:/remote/release.zip']) {
    const link = page.getByRole('button', { name: `预览文件：${path}`, exact: true });
    await link.click({ button: 'right' });
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem')).toHaveText(['下载到本机…']);
    await expect(menu.getByRole('separator')).toHaveCount(0);
    await expect(page.locator('aside[data-details-panel]:visible')).toHaveCount(0);
    const bounds = (await menu.boundingBox())!;
    expect(bounds.width).toBeLessThanOrEqual(400);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await link.click();
    const drawer = page.locator('aside[data-details-panel]');
    const card = drawer.getByRole('region', { name: path.split('/').at(-1)!, exact: true });
    await expect(card).toBeVisible();
    await expect(card.locator('.resource-download-name')).toHaveText(path.split('/').at(-1)!);
    await screenshot(page, info, `download-only-${path.split('.').at(-1)}`);
    await card.getByRole('button', { name: '下载', exact: true }).click();
    await expect(page.getByLabel('文件操作结果')).toHaveText(JSON.stringify({
      computer: 'remote-PC', path, threadId: 'remote-thread', action: 'saveAs',
    }));
    await drawer.getByRole('button', { name: '关闭详情抽屉', exact: true }).click();
  }
});

test('remote files preview on left click across peer versions; right click opens actions', async ({ page }, info) => {
  await page.goto('e2e/file-preview-harness.html?pc&legacy');
  const link = page.getByRole('button', { name: '预览文件：F:/remote/docs/guide.md', exact: true });
  await link.click();
  const drawer = page.locator('aside[data-details-panel]');
  await expect(drawer.getByRole('heading', { name: '远程文档', exact: true })).toBeVisible();
  await expect.poll(() => drawer.getByRole('img', { name: '相邻图片' })
    .evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByLabel('文件操作结果')).toBeEmpty();
  await drawer.getByRole('button', { name: '预览文件：F:/remote/docs/next.md', exact: true }).click();
  await expect(drawer.getByRole('heading', { name: '后续文档', exact: true })).toBeVisible();
  await expect(drawer).toContainText('引用位置：第 3 行');
  await drawer.getByRole('button', { name: '返回上一页' }).click();
  await expect(drawer.getByRole('heading', { name: '远程文档', exact: true })).toBeVisible();
  await screenshot(page, info, 'remote-compatible-preview');
  await drawer.getByRole('button', { name: '关闭详情抽屉' }).click();
  await link.click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: '在远程电脑上打开', exact: true })).toBeVisible();
  expect((await page.getByRole('menu').boundingBox())!.width).toBeLessThanOrEqual(400);
  await expect(drawer).toBeHidden();
  await expect(drawer).toHaveCount(1);
  await page.getByRole('menuitem', { name: '预览文件', exact: true }).click();
  await expect(drawer.getByRole('heading', { name: '远程文档', exact: true })).toBeVisible();
  await expect(page.getByLabel('文件操作结果')).toBeEmpty();
});

test('PC remote files share tables, code, source location, menus and relative HTML assets', async ({ page }, info) => {
  await page.goto('e2e/file-preview-harness.html?pc');
  await page.getByRole('button', { name: '预览文件：F:/remote/docs/guide.md', exact: true }).click();
  const drawer = page.locator('aside[data-details-panel]');
  await expect(drawer.getByRole('heading', { name: '远程文档' })).toBeVisible();
  await expect(drawer.getByRole('button', { name: '展开表格' })).toBeVisible();
  await expect(drawer.getByRole('button', { name: '自动换行' })).toBeVisible();
  await expect.poll(() => drawer.getByRole('img', { name: '相邻图片' })
    .evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(160);
  await drawer.getByRole('button', { name: '预览文件：F:/remote/docs/next.md', exact: true }).click();
  await expect(drawer.getByRole('button', { name: '源码', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(drawer.getByLabel('文件内容', { exact: true })).toContainText('这是远程电脑的第三行。');
  await drawer.getByRole('button', { name: '返回上一页' }).click();
  await drawer.getByRole('button', { name: '文件操作：F:/remote/docs/guide.md', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: '下载到本机…' })).toBeVisible();
  await page.getByRole('menuitem', { name: '在远程电脑上打开', exact: true }).click();
  await expect(page.getByLabel('文件操作结果')).toContainText('"computer":"remote-PC"');
  await expect(page.getByLabel('文件操作结果')).toContainText('F:/remote/docs/guide.md');
  await screenshot(page, info, 'pc-shared-file-preview');
  await drawer.getByRole('button', { name: '预览文件：F:/remote/docs/index.html', exact: true }).click();
  const frame = page.frameLocator('iframe[title="HTML 预览"]');
  await expect(frame.getByRole('heading', { name: '远程 HTML' })).toBeVisible();
  await expect(frame.locator('body')).toHaveCSS('color', 'rgb(24, 80, 120)');
  await expect.poll(() => frame.getByRole('img').evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(160);
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
});

test('PC remote Markdown links use browser tabs with retained source controls', async ({ page }, info) => {
  await page.goto('e2e/file-preview-harness.html?workspace');
  await page.getByRole('button', { name: '交接文档', exact: true }).click();
  const drawer = page.locator('aside[data-details-panel]');
  const browser = drawer.locator('.website-preview-browser');
  const preview = browser.getByRole('tabpanel');
  await expect(preview.getByRole('heading', { name: '文件预览', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(drawer).toHaveAttribute('role', 'dialog');
  await expect.poll(async () => {
    const bounds = await drawer.boundingBox();
    return Math.abs(bounds!.x + bounds!.width - page.viewportSize()!.width);
  }).toBeLessThanOrEqual(1);
  await preview.getByRole('button', { name: '原文', exact: true }).click();
  await expect(preview.locator('pre')).toContainText('# 文件预览');
  await drawer.getByRole('button', { name: '最小化详情抽屉', exact: true }).click();
  await expect(drawer).toBeHidden();
  await page.getByRole('button', { name: '恢复预览', exact: true }).click();
  await expect(preview.locator('pre')).toContainText('# 文件预览');
  await preview.getByRole('button', { name: '预览', exact: true }).click();
  await preview.getByRole('button', { name: '后续文档', exact: true }).click();
  await expect(preview.getByRole('heading', { name: '后续文档' })).toBeVisible();
  await expect(browser.getByLabel('页面地址', { exact: true }))
    .toHaveValue('file:///F:/remote/docs/next.md');
  await expect(page.locator('aside[data-details-panel]')).toHaveCount(1);
  await expect(browser.getByRole('tab')).toHaveCount(2);
  await browser.getByRole('tab', { name: 'handoff.md', exact: true }).click();
  await expect(preview.getByRole('heading', { name: '文件预览', exact: true })).toBeVisible();
  await drawer.getByRole('button', { name: '最小化详情抽屉' }).click();
  await expect(drawer).toBeHidden();
  await page.getByRole('button', { name: '恢复预览' }).click();
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('button', { name: '下载', exact: true })).toBeEnabled();
  await screenshot(page, info, 'remote-markdown-drawer');
  await drawer.getByRole('button', { name: '关闭详情抽屉' }).click();
  await expect(drawer).toBeHidden();
  await page.getByRole('button', { name: '交接文档', exact: true }).click();
  await expect(preview.getByRole('heading', { name: '文件预览', exact: true })).toBeVisible();
});

test('previews HTML scripts in an isolated frame and retains source and download actions', async ({ page }) => {
  await open(page, 'page.HTML');
  const frame = page.frameLocator('iframe[title="HTML 预览"]');
  await expect(frame.getByRole('heading', { name: '页面预览' })).toBeVisible();
  await expect(frame.locator('body')).toHaveAttribute('data-ready', 'yes');
  expect(await page.evaluate(() => Reflect.get(window, 'previewScriptRan'))).toBeUndefined();
  expect(await page.evaluate(() => localStorage.getItem('unsafe'))).toBeNull();
  await page.getByRole('button', { name: '源码', exact: true }).click();
  await expect(page.locator('.chat-html-preview pre')).toContainText('<h1>页面预览</h1>');
  await expect(page.getByRole('button', { name: '下载', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '预览', exact: true }).click();
  await expect(frame.getByRole('heading', { name: '页面预览' })).toBeVisible();
});

test('renders Markdown, preserves source copying and contains tables on narrow screens', async ({ page }, info) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page);
  const rendered = page.locator('.chat-markdown-preview .chat-markdown');
  await expect(rendered.getByRole('heading', { name: '文件预览', exact: true })).toBeVisible();
  await expect(rendered.locator('strong')).toHaveText('Markdown 渲染');
  await expect(rendered.locator('li')).toHaveCount(2);
  await expect(rendered.getByRole('cell', { name: '通过', exact: true })).toBeVisible();
  await expect(rendered.locator('pre')).toHaveText('const ready = true;');
  await expect(page.getByRole('button', { name: '下载', exact: true })).toBeVisible();
  await expect(page.getByText('引用位置：第 3 行')).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, 'previewScriptRan'))).toBeUndefined();
  if (info.project.name === 'desktop') {
    await page.getByRole('button', { name: '复制原文', exact: true }).click();
    expect(await clipboard(page)).toBe(markdown);
  }
  const table = await rendered.locator('table').boundingBox();
  expect(table!.x + table!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await screenshot(page, info, 'markdown-file-preview');
  await page.getByRole('button', { name: '原文', exact: true }).click();
  await expect(rendered).toHaveCount(0);
  await expect(page.locator('.chat-markdown-preview pre')).toHaveText(markdown);
  await page.getByRole('button', { name: '复制原文', exact: true }).first().click();
  expect(await clipboard(page)).toBe(markdown);
  await page.getByRole('button', { name: '预览', exact: true }).click();
  await expect(rendered.locator('table')).toBeVisible();
});

test('copies the complete source even when the long source view is paginated', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, 'long.md');
  await page.getByRole('button', { name: '原文', exact: true }).click();
  await expect(page.locator('pre')).not.toContainText('最后一行');
  await page.getByRole('button', { name: '复制原文', exact: true }).first().click();
  expect(await clipboard(page)).toBe(longMarkdown);
});

test('previews and copies code from an external deployment path', async ({ page }, info) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, externalCodePath);
  await expect(page.locator('pre')).toHaveText(sourceCode);
  await page.getByRole('button', { name: '复制文件内容', exact: true }).click();
  expect(await clipboard(page)).toBe(sourceCode);
  await expect(page.getByRole('button', { name: '下载', exact: true })).toBeEnabled();
  const code = await page.locator('pre').boundingBox();
  expect(code!.x + code!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await screenshot(page, info, 'external-code-file-preview');
});

test('handles uppercase extensions, empty files, ordinary source and load failures', async ({ page }, info) => {
  await open(page, 'README.MARKDOWN');
  await expect(page.locator('.chat-markdown-preview table')).toBeVisible();
  await open(page, 'empty.md');
  await expect(page.getByText('（空文件）')).toBeVisible();
  if (info.project.name === 'mobile') await page.getByRole('button', { name: '原文', exact: true }).click();
  await expect(page.getByRole('button', { name: '复制原文' })).toBeEnabled();
  await open(page, 'source.ts');
  await expect(page.locator('.chat-markdown-preview')).toHaveCount(0);
  await expect(page.locator('pre')).toHaveText('const ready = true;\n');
  await expect(page.getByRole('button', { name: '复制文件内容' })).toBeVisible();
  await open(page, 'missing.md');
  await expect(page.getByRole('status')).toContainText('暂时无法预览此文件');
  await expect(page.getByRole('button', { name: '复制原文' })).toHaveCount(0);
});

test('installer downloads use a compact card and can cancel, restart and save exact bytes', async ({ page }, info) => {
  const name = 'Remote AI_1.7.9_x64_en-US.msi';
  await open(page, name);
  const sheet = page.locator('.chat-download-sheet');
  await expect(sheet.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(sheet).not.toContainText('暂时无法预览');
  await sheet.getByRole('button', { name: '下载', exact: true }).click();
  const progress = sheet.getByRole('progressbar', { name: '下载进度', exact: true });
  await expect.poll(() => progress.getAttribute('value')).toMatch(/^[1-9]/);
  await expect(sheet.locator('.file-download-detail')).toContainText(/MB.*[KM]B\/s/);
  const bounds = await sheet.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(448);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await screenshot(page, info, 'installer-download-progress');
  await sheet.getByRole('button', { name: '取消下载', exact: true }).click();
  await expect(sheet.getByRole('status')).toHaveText('下载已取消');
  const saving = page.waitForEvent('download');
  await sheet.getByRole('button', { name: '下载', exact: true }).click();
  const download = await saving;
  expect(download.suggestedFilename()).toBe(name);
  expect(await readFile((await download.path())!)).toEqual(Buffer.alloc(8 * 1024 * 1024, 'A'));
  await expect(sheet.getByRole('status')).toHaveText('文件已交给浏览器保存');
});

test('download cards contain long filenames and retain readable failure and offline states', async ({ page }, info) => {
  const name = `${'安装程序_very-long-name_'.repeat(8)}.MSI`;
  await page.goto(`e2e/file-preview-harness.html?path=${encodeURIComponent(name)}&download=offline`);
  const sheet = page.locator('.chat-download-sheet');
  await expect(sheet.getByRole('button', { name: '下载', exact: true })).toBeDisabled();
  const heading = sheet.getByRole('heading', { name, exact: true });
  await expect(heading).toBeVisible();
  expect(await heading.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await screenshot(page, info, 'installer-download-long-name');
  await page.goto('e2e/file-preview-harness.html?path=installer.msi&download=error');
  await sheet.getByRole('button', { name: '下载', exact: true }).click();
  await expect(sheet.getByRole('status')).toHaveText('下载失败，请检查连接和存储空间后重试。');
  await expect(sheet.getByRole('button', { name: '下载', exact: true })).toBeEnabled();
});
