import { expect, type Page, type TestInfo } from '@playwright/test';

export async function openMouseBrowser(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('codex-switch.web.session.v1', JSON.stringify({
    baseUrl: location.origin + '/mouse-account', email: 'mouse@example.test', accessToken: 'fixture', refreshToken: 'fixture',
  })));
  await page.route('**/mouse-account/**', route => route.fulfill({ json: {
    accounts: [], devices: [], providers: [], id: 'mouse', email: 'mouse@example.test', ticket: 'fixture',
  } }));
  await page.goto('./');
  await page.locator('.mobile-tabbar').getByRole('tab', { name: '浏览器', exact: true }).click();
  return page.locator('.browser-main-page');
}

export async function verifyBrowserMouse({ page }: { page: Page }, info: TestInfo) {
  const browser = await openMouseBrowser(page);
  await page.route('**/mouse-page', route => route.fulfill({ contentType: 'text/html',
    body: '<meta name="viewport" content="width=device-width, initial-scale=1"><style>body{height:250vh;width:250vw;'
      + 'font:20px system-ui;background:#f4f7f5;color:#234637}main{padding:22px}</style>'
      + '<main><h2>网页鼠标测试</h2><output>等待操作</output></main><script>'
      + 'for (const name of ["click","dblclick","contextmenu","pointermove","pointerup"]) '
      + 'document.addEventListener(name,e=>{if(name==="contextmenu") e.preventDefault();'
      + 'if(name==="pointermove" && !e.buttons)return;document.querySelector("output").textContent=name+":"+e.buttons;});'
      + '</script>' }));
  const settings = browser.getByRole('button', { name: '浏览器设置', exact: true });
  const toggle = page.getByRole('checkbox', { name: '鼠标操作' });
  const address = browser.getByLabel('页面地址', { exact: true });
  await address.fill(new URL('/mouse-page', info.project.use.baseURL).href); await address.press('Enter');
  const frame = browser.locator('.browser-tab-selected iframe').contentFrame();
  await expect(frame.getByRole('heading')).toBeVisible();
  const panel = browser.locator('.rd-mouse');
  await expect(panel).toHaveCount(0);
  await settings.click(); await expect(toggle).not.toBeChecked();
  await toggle.click({ trial: true });
  await expect(page.locator('.adm-toast-mask')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('web-mobile-settings-off.png'), animations: 'disabled' });
  await toggle.click(); await expect(panel).toBeVisible();
  await expect(page.locator('.browser-bookmark-settings-popup:visible')).toHaveCount(0);
  await expect(page.locator('.adm-toast-mask')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('web-mobile-mouse.png') });
  await panel.locator('.rd-pad').dblclick();
  await expect(frame.locator('output')).toHaveText('dblclick:0');
  await panel.getByRole('button', { name: '鼠标右键' }).click({ position: { x: 28, y: 22 } });
  const press = async (selector: string, x: number, y: number) => {
    await panel.locator(selector).click({ position: { x, y }, trial: true });
    const box = (await panel.locator(selector).boundingBox())!;
    await page.mouse.move(box.x + x, box.y + y); await page.mouse.down();
    return { x: box.x + x, y: box.y + y };
  };
  await press('.rd-mouse-top button:last-child', 40, 20);
  await expect(frame.locator('output')).toHaveText('contextmenu:2'); await page.mouse.up();
  const left = await press('.rd-mouse-top button:first-child', 22, 25);
  await page.mouse.move(left.x + 24, left.y + 20, { steps: 3 });
  await expect(frame.locator('output')).toHaveText('pointermove:1'); await page.mouse.up();
  await press('.rd-mouse-top button:first-child', 22, 25);
  await expect(panel.locator('.rd-mouse-top button').first()).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.up();
  await page.screenshot({ path: info.outputPath('web-mobile-drag.png') });
  const grip = await press('.rd-grip', 16, 14);
  await page.mouse.move(grip.x - 32, grip.y - 20, { steps: 3 }); await page.mouse.up();
  await expect(frame.locator('output')).toHaveText('pointermove:1');
  await press('.rd-mouse-top button:first-child', 22, 25); await page.mouse.up();
  for (const horizontal of [false, true]) {
    const wheel = await press('.rd-wheel', 14, 20);
    await page.mouse.move(wheel.x + (horizontal ? 48 : 0), wheel.y + (horizontal ? 0 : 48));
    await expect.poll(() => frame.locator('body').evaluate((_, x) => x ? window.scrollX : window.scrollY, horizontal))
      .toBeGreaterThan(0);
    if (!horizontal) await page.screenshot({ path: info.outputPath('web-mobile-wheel.png') });
    await page.mouse.up();
  }
  const icon = browser.locator('.rd-mouse-icon');
  await expect(icon).toBeVisible({ timeout: 13_000 });
  await icon.click(); await expect(panel).toBeVisible();
  const cursor = (await browser.locator('.rd-cursor').boundingBox())!;
  const frameBox = (await browser.locator('.browser-tab-selected iframe').boundingBox())!;
  await frame.locator('body').evaluate((body, { x, y }) => {
    const button = body.ownerDocument.createElement('button');
    button.style.cssText = `position:fixed;left:${x - 10}px;top:${y - 10}px;width:30px;height:30px`;
    button.draggable = true;
    button.onclick = () => { button.textContent = 'clicked'; };
    button.ondragstart = event => event.dataTransfer!.setData('text/plain', 'dragged');
    body.append(button);
    body.ondragover = event => event.preventDefault();
    body.ondrop = event => { body.dataset.drop = event.dataTransfer!.getData('text/plain'); };
  }, { x: cursor.x - frameBox.x, y: cursor.y - frameBox.y });
  await panel.locator('.rd-pad').click();
  await expect(frame.getByRole('button', { name: 'clicked' })).toBeFocused();
  const leftBox = (await panel.locator('.rd-mouse-top button').first().boundingBox())!;
  const touch = await page.context().newCDPSession(page);
  const finger = { x: leftBox.x + 22, y: leftBox.y + 25 };
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger] });
  for (const dx of [10, 30, 60]) await touch.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [{ ...finger, x: finger.x + dx }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach();
  await expect(frame.locator('body')).toHaveAttribute('data-drop', 'dragged');
  await page.route('https://frame.example.test/page', route => route.fulfill({ contentType: 'text/html',
    body: '<meta name="viewport" content="width=device-width, initial-scale=1">'
      + '<button style="margin:48px" onclick="this.textContent=1">0</button>' }));
  await address.fill('https://frame.example.test/page'); await address.press('Enter');
  const foreignButton = frame.getByRole('button', { name: '0' });
  await expect(foreignButton).toBeVisible(); await expect(panel).toHaveCount(0);
  await foreignButton.tap(); await expect(frame.getByRole('button', { name: '1' })).toBeVisible();
  await browser.getByRole('button', { name: '浏览器首页' }).click(); await expect(panel).toBeVisible();
  await page.screenshot({ path: info.outputPath('web-mobile-mouse-home.png') });
  await page.reload();
  await page.locator('.mobile-tabbar').getByRole('tab', { name: '浏览器', exact: true }).click();
  await settings.click(); await expect(toggle).toBeChecked(); await toggle.click();
  await expect(panel).toHaveCount(0);
}
