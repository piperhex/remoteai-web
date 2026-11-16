import { test } from '@playwright/test';
import { checkWorkspaceAddTab } from '../../desktop/e2e/workspace-add-tab-checks';

for (const enlarged of [false, true]) {
  test(`web desktop: add workspace tabs ${enlarged ? 'dark narrow font20' : 'light wide font14'}`,
    async ({ page }, info) => {
      await page.setViewportSize({ width: enlarged ? 1024 : 1440, height: 900 });
      await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
      const query = `mode=web&changes&submodules&font=${enlarged ? 20 : 14}${enlarged ? '&dark' : ''}`;
      await checkWorkspaceAddTab({ page, info, label: `web-${enlarged ? 'dark-font20' : 'light-font14'}`,
        url: `e2e/workspace-start-harness.html?${query}` });
    });
}
