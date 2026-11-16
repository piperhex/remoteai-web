import { test } from '@playwright/test';
import { checkSafeUpdate } from '../../desktop/e2e/git-update-checks';

for (const enlarged of [false, true]) {
  test(`web: safe update ${enlarged ? 'dark narrow font20' : 'light wide font14'}`, async ({ page }, info) => {
    await page.setViewportSize({ width: enlarged ? 720 : 1280, height: 900 });
    await checkSafeUpdate({ page, info, label: `web-${enlarged ? 'dark-font20' : 'light-font14'}`,
      url: `e2e/git-update.html?mode=web&font=${enlarged ? 20 : 14}${enlarged ? '&dark' : ''}` });
  });
}
