import { test } from '@playwright/test';
import { prepareAddressPages, verifyAddressDisplay } from '../../desktop/e2e/browser-address-checks';

test.use({ hasTouch: true });

for (const entry of ['desktop-main', 'desktop-sidebar', 'mobile']) for (const enlarged of [false, true]) {
  const mobile = entry === 'mobile';
  const label = `web-${entry}-${enlarged ? 'dark-20px-narrow' : 'light-14px'}`;
  test(label, async ({ page }, info) => {
    await page.setViewportSize({ width: mobile ? (enlarged ? 360 : 390) : (enlarged ? 900 : 1440), height: 900 });
    await prepareAddressPages(page);
    const query = `${entry.endsWith('sidebar') ? 'sidebar=1&' : ''}${enlarged ? 'dark=1&font=20' : ''}`;
    await page.goto(`e2e/web-browser-bookmarks-harness.html?${query}`, { waitUntil: 'domcontentloaded' });
    await verifyAddressDisplay({ page, info, label, mobile });
  });
}
