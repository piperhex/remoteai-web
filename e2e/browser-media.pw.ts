import { expect, test } from '@playwright/test';

const site = 'https://capture.example.test';
const capturePage = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font:16px system-ui;padding:16px;background:#f7faf7;color:#183e2b}
button{display:block;margin:16px 0;padding:12px}pre{white-space:pre-wrap}</style>
<h2>Media permission check</h2><button data-kind="audio">Microphone</button>
<button data-kind="video">Camera</button><button data-kind="both">Microphone and camera</button><pre></pre>
<script>document.querySelectorAll('button').forEach(button => button.onclick = async () => {
  document.querySelector('pre').textContent = 'Waiting for capture';
  try {
    const kind = button.dataset.kind;
    const stream = await navigator.mediaDevices.getUserMedia({audio: kind !== 'video', video: kind !== 'audio'});
    const tracks = stream.getTracks();
    document.querySelector('pre').textContent = JSON.stringify({live: tracks.every(t => t.readyState === 'live'),
      tracks: tracks.map(t => t.kind).sort()});
    tracks.forEach(track => track.stop());
  } catch (error) { document.querySelector('pre').textContent = error.name; }
});</script>`;

for (const dark of [false, true]) test(`mobile web capture follows browser consent (${dark ? 'dark' : 'light'})`,
  async ({ page, context }, info) => {
    await page.setViewportSize({ width: dark ? 430 : 390, height: 844 });
    await context.route(`${site}/**`, route => route.fulfill({ contentType: 'text/html', body: capturePage }));
    await context.grantPermissions([], { origin: site });
    await page.goto(`e2e/web-browser-bookmarks-harness.html${dark ? '?dark&font=20' : ''}`);
    expect(await page.evaluate(() => innerWidth)).toBe(dark ? 430 : 390);
    const address = page.getByRole('textbox', { name: '页面地址', exact: true });
    await address.fill(site); await address.press('Enter');
    const frame = page.locator('.pm-browser-page:visible iframe');
    await expect(frame).toHaveAttribute('allow', 'microphone; camera; geolocation');
    const content = frame.contentFrame();
    await content.getByRole('button', { name: 'Microphone', exact: true }).click();
    await expect(content.locator('pre')).toHaveText('NotAllowedError');
    await page.screenshot({ path: info.outputPath(`mobile-web-${dark ? 'dark' : 'light'}-denied.png`) });
    await context.grantPermissions(['microphone', 'camera']);
    const captures = [
      ['Microphone', ['audio']], ['Camera', ['video']], ['Microphone and camera', ['audio', 'video']],
    ] as const;
    // Stopping tracks must not add an application prompt to subsequent browser-authorized captures.
    for (const [name, tracks] of [...captures, ...captures]) {
      await content.getByRole('button', { name, exact: true }).click();
      await expect(content.locator('pre')).toHaveText(JSON.stringify({ live: true, tracks }));
    }
    await page.screenshot({ path: info.outputPath(`mobile-web-${dark ? 'dark' : 'light'}-authorized.png`) });
    await address.fill(`${site}/reloaded`); await address.press('Enter');
    await content.getByRole('button', { name: 'Microphone and camera', exact: true }).click();
    await expect(content.locator('pre')).toHaveText(JSON.stringify({ live: true, tracks: ['audio', 'video'] }));
    await page.screenshot({ path: info.outputPath(`mobile-web-${dark ? 'dark' : 'light'}-retained.png`) });
  });
