import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { openMouseBrowser } from './browser-mouse-checks';

async function bounds(item: Locator) {
  await expect(item).toBeVisible();
  return (await item.boundingBox())!;
}

export async function verifyBrowserMouseEdge({ page }: { page: Page }, info: TestInfo) {
  const browser = await openMouseBrowser(page);
  const address = browser.getByLabel('页面地址', { exact: true });
  await page.route('**/mouse-edge/*', route => {
    const next = route.request().url().endsWith('/next');
    return route.fulfill({ contentType: 'text/html', body: `<meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>body{margin:24px;font:18px system-ui;color:#234637;background:#f4f7f5}
      h2{text-align:right}a{position:fixed;right:0;top:30%;bottom:30%;width:48px;background:#d4eadc;
      display:grid;place-items:center}</style>
      <h2>${next ? '已打开详情' : '项目列表'}</h2><a href="next">${next ? '刷新' : '详情'}</a>` });
  });
  const visit = async (path: string) => {
    await address.fill(new URL(path, info.project.use.baseURL).href);
    await address.press('Enter');
  };
  await visit('/mouse-edge/list');
  const tab = browser.locator('.browser-tab-selected');
  const frame = tab.locator('iframe').contentFrame();
  await expect(frame.getByRole('heading')).toHaveText('项目列表');
  await browser.getByRole('button', { name: '浏览器设置', exact: true }).click();
  await page.getByRole('checkbox', { name: '鼠标操作' }).click();
  const panel = tab.locator('.rd-mouse');
  const cursor = tab.locator('.rd-cursor');
  const canvas = tab.locator('.browser-tab-canvas');
  const stage = await bounds(tab);
  await expect(page.locator('.adm-toast-mask')).toHaveCount(0);
  const move = async (dx: number) => {
    const grip = await bounds(panel.locator('.rd-grip'));
    const x = grip.x + 8, y = grip.y + grip.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + dx, y, { steps: 4 }); await page.mouse.up();
  };
  for (let index = 0; index < 4; index++) await move(60);
  const corner = await bounds(cursor);
  const controls = await bounds(panel);
  const panned = await bounds(canvas);
  expect(controls.x - corner.x).toBeCloseTo(24, 0);
  expect(controls.x + controls.width).toBeLessThan(stage.x + stage.width);
  expect(panned.x + panned.width).toBeLessThan(controls.x);
  expect(panned.width).toBe(stage.width);
  await page.screenshot({ path: info.outputPath('web-mobile-right-edge.png') });
  await panel.locator('.rd-pad').click();
  await expect(frame.getByRole('heading')).toHaveText('已打开详情');
  const assertStationary = async () => {
    expect(await bounds(cursor)).toEqual(corner);
    expect(await bounds(panel)).toEqual(controls);
  };
  await assertStationary();
  await page.screenshot({ path: info.outputPath('web-mobile-after-link.png') });
  await Promise.all([
    page.waitForEvent('framenavigated', target => target.url().endsWith('/mouse-edge/next')),
    frame.locator('body').evaluate(body => body.ownerDocument.location.reload()),
  ]);
  await expect(frame.getByRole('heading')).toHaveText('已打开详情');
  await assertStationary();
  await page.setViewportSize({ width: 390, height: 760 });
  await assertStationary();
  await browser.getByRole('button', { name: '浏览器首页' }).click(); await assertStationary();
  await visit('/mouse-edge/reopened'); await expect(frame.getByRole('heading')).toHaveText('项目列表');
  await assertStationary();
  await move(-55);
  expect((await bounds(panel)).x).toBeLessThan(controls.x);
  expect((await bounds(canvas)).x).toBeGreaterThan(panned.x);
}
