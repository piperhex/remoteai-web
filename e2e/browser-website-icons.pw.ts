import { test } from '@playwright/test';
import { verifyWebsiteIcons } from '../../desktop/e2e/browser-website-icons-checks';

for (const dark of [false, true]) {
  test(`web ${dark ? 'dark narrow' : 'light wide'} website and bookmark icons`, async ({ page }, info) => {
    await page.setViewportSize({ width: dark ? 1000 : 1440, height: 900 });
    await verifyWebsiteIcons({ page, info, scope: 'web-bookmarks',
      harness: `e2e/web-browser-bookmarks-harness.html${dark ? '?dark=1' : ''}`,
      label: `web-desktop-${dark ? 'dark-narrow' : 'light-wide'}` });
  });
}
