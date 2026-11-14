import { expect, test } from '@playwright/test';

const site = 'https://location.example.test';
const locationPage = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font:16px system-ui;padding:16px;background:#f7faf7;color:#183e2b}button{padding:12px}</style>
<h2>Location permission check</h2><button>Request location</button><pre></pre><script>
document.querySelector('button').onclick = () => {
  document.querySelector('pre').textContent = 'Waiting for location';
  navigator.geolocation.getCurrentPosition(position => {
    document.querySelector('pre').textContent = Number.isFinite(position.coords.latitude) ? 'Location available' : 'Invalid';
  }, error => { document.querySelector('pre').textContent = 'LocationError' + error.code; });
};</script>`;

for (const dark of [false, true]) test(`mobile web location follows browser consent (${dark ? 'dark' : 'light'})`,
  async ({ page, context }, info) => {
    await page.setViewportSize({ width: dark ? 430 : 390, height: 844 });
    await context.setGeolocation({ latitude: 51.5, longitude: -0.1 });
    await context.route(`${site}/**`, route => route.fulfill({ contentType: 'text/html', body: locationPage }));
    await context.grantPermissions([], { origin: site });
    await page.goto(`e2e/web-browser-bookmarks-harness.html${dark ? '?dark&font=20' : ''}`);
    const address = page.getByRole('textbox', { name: '页面地址', exact: true });
    await address.fill(site); await address.press('Enter');
    const frame = page.locator('.pm-browser-page:visible iframe');
    await expect(frame).toHaveAttribute('allow', 'microphone; camera; geolocation');
    const content = frame.contentFrame();
    await content.getByRole('button', { name: 'Request location' }).click();
    await expect(content.locator('pre')).toHaveText('LocationError1');
    await page.screenshot({ path: info.outputPath(`location-${dark ? 'dark' : 'light'}-denied.png`) });
    await context.grantPermissions(['geolocation']);
    for (let attempt = 0; attempt < 2; attempt++) {
      await content.getByRole('button', { name: 'Request location' }).click();
      await expect(content.locator('pre')).toHaveText('Location available');
    }
    await address.fill(`${site}/reloaded`); await address.press('Enter');
    await content.getByRole('button', { name: 'Request location' }).click();
    await expect(content.locator('pre')).toHaveText('Location available');
    await page.screenshot({ path: info.outputPath(`location-${dark ? 'dark' : 'light'}-retained.png`) });
  });
