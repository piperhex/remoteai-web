import { test, expect } from '@playwright/test';
import { openChatList, connect, send, state, fixtureUrl, operationCount, login, navigate } from './chat-helpers';

test('shows local messages and clears the composer while acknowledgements are delayed', async ({ page, request }, info) => {
  await request.post(`${fixtureUrl}/test/reset`);
  await login(page);
  await connect(page);
  await expect(page.getByText('欢迎回来', { exact: true })).toBeHidden();
  await openChatList(page);
  await page.getByRole('button', { name: '移动端聊天体验', exact: true }).click();
  await send(page, 'slow local outbox');
  await expect(page.getByRole('button', { name: '暂停生成' })).toBeVisible();
  await request.post(`${fixtureUrl}/test/submission-delay`, { data: { milliseconds: 10000 } });
  try {
    const input = page.getByRole('textbox', { name: '聊天消息' });
    for (const text of ['立即进入本地队列', '后台提交时继续发送']) {
      await input.fill(text);
      await page.getByRole('button', { name: '发送消息', exact: true }).click();
      await expect(input).toHaveValue('', { timeout: 1000 });
    }
    const queue = page.getByRole('region', { name: '待发送消息', exact: true });
    await expect(queue.getByRole('listitem')).toHaveCount(2);
    await expect(queue.getByRole('status')).toHaveCount(2);
    await page.screenshot({ path: info.outputPath(`web-${info.project.name}-local-pending.png`) });
    await request.post(`${fixtureUrl}/test/submission-delay`, { data: { milliseconds: 0 } });
    await expect(queue.getByRole('status')).toHaveCount(0, { timeout: 15000 });
    await expect(queue.getByRole('listitem')).toHaveCount(2);
  } finally { await request.post(`${fixtureUrl}/test/submission-delay`, { data: { milliseconds: 0 } }); }
});

test('desktop web remembers the queue setting and sends directly while a task is running', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'The setting is in the desktop GUI settings.');
  await request.post(`${fixtureUrl}/test/reset`);
  await login(page);
  await connect(page);
  await openChatList(page);
  await page.getByRole('button', { name: '移动端聊天体验', exact: true }).click();
  await send(page, 'slow queue settings');
  await expect(page.getByRole('button', { name: '暂停生成' })).toBeVisible();
  await page.getByRole('button', { name: 'Codex GUI 设置', exact: true }).click();
  const toggle = page.getByRole('switch', { name: '待发送', exact: true });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
  await expect(page.getByRole('dialog')).toHaveCSS('transform', 'none');
  await page.screenshot({ path: info.outputPath('web-message-settings.png') });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  const before = await operationCount(request, 'queueEnqueue');
  await send(page, '立即发送的 Web 消息');
  await expect.poll(async () => (await state(request)).operations
    .filter(operation => operation.operation === 'steer').map(operation => operation.text))
    .toEqual(['立即发送的 Web 消息']);
  expect(await operationCount(request, 'queueEnqueue')).toBe(before);
  await expect(page.getByRole('region', { name: '待发送消息', exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Codex GUI 设置', exact: true }).click();
  await expect(toggle).not.toBeChecked();
});

test('queues supplements on the PC, sends one immediately and restores the rest after reconnecting',
  async ({ page, request }) => {
    await request.post(`${fixtureUrl}/test/reset`);
    await page.goto('./');
    await page.getByPlaceholder('name@example.com').fill('mobile-test@example.test');
    await page.getByPlaceholder('输入登录密码').fill('local-test');
    await page.getByRole('button', { name: '登录并查看' }).click();
    await page.getByRole('button', { name: '同意并登录' }).click();
    await connect(page);
    await expect(page.getByRole('status').filter({ hasText: /P2P|Relay/ }))
      .toBeVisible({ timeout: 20_000 });
    await openChatList(page);
    await page.getByRole('button', { name: '移动端聊天体验', exact: true }).click();
    await send(page, 'slow queue test');
    await expect(page.getByRole('button', { name: '暂停生成' })).toBeVisible();
    await send(page, '先检查边界情况');
    await send(page, '再补充回归测试');
    const queue = page.getByRole('region', { name: '待发送消息', exact: true });
    await expect(queue.getByRole('listitem')).toHaveCount(2);
    const queueBounds = (await queue.boundingBox())!;
    const desktop = page.viewportSize()!.width > 860;
    const leftBounds = (await page.locator(desktop ? '.chat-composer-add' : '.chat-composer').boundingBox())!;
    const rightBounds = (await page.locator(desktop ? '.chat-composer-submit' : '.chat-composer').boundingBox())!;
    expect(queueBounds.x).toBeCloseTo(leftBounds.x, 0);
    expect(queueBounds.x + queueBounds.width).toBeCloseTo(rightBounds.x + rightBounds.width, 0);
    const first = queue.getByRole('listitem').first();
    await expect(queue.getByRole('button', { name: '上移待发送消息' })).toBeDisabled();
    await queue.getByRole('button', { name: '下移待发送消息' }).click();
    await expect(first).toContainText('再补充回归测试');
    await queue.getByRole('button', { name: '上移待发送消息' }).click();
    await expect(first).toContainText('先检查边界情况');
    await page.getByRole('textbox', { name: '聊天消息' }).fill('已有草稿');
    await expect(queue.getByRole('button', { name: '编辑待发送消息' })).toBeDisabled();
    await page.getByRole('textbox', { name: '聊天消息' }).fill('');
    await queue.getByRole('button', { name: '编辑待发送消息' }).click();
    await expect(page.getByRole('textbox', { name: '聊天消息' })).toHaveValue('先检查边界情况');
    await expect(queue.getByRole('listitem')).toHaveCount(1);
    await send(page, '先检查边界情况（已编辑）');
    await expect(queue.getByRole('listitem')).toHaveCount(2);
    await queue.getByRole('button', { name: '选择待发送消息：先检查边界情况（已编辑）', exact: true }).click();
    await queue.getByRole('button', { name: '上移待发送消息' }).click();
    await expect(first).toContainText('先检查边界情况（已编辑）');
    await page.screenshot({ path: test.info().outputPath('queue-controls.png') });
    const streamed = await page.locator('.chat-markdown').last().innerText();
    await expect.poll(() => page.locator('.chat-markdown').last().innerText()).not.toBe(streamed);
    expect(await operationCount(request, 'steer')).toBe(0);
    await queue.getByRole('listitem').filter({ hasText: '先检查边界情况' })
      .getByRole('button', { name: '立即发送' }).click();
    await expect(queue.getByRole('listitem')).toHaveCount(1);
    expect(await operationCount(request, 'steer')).toBe(1);
    await request.post(`${fixtureUrl}/test/disconnect`);
    await expect(page.getByRole('status').filter({ hasText: /P2P|Relay/ }))
      .toBeVisible({ timeout: 20_000 });
    await expect(queue).toContainText('再补充回归测试');
    await page.setViewportSize({ width: 390, height: 480 });
    const bounds = (await queue.boundingBox())!;
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    await queue.getByRole('button', { name: '删除待发送消息' }).click();
    await expect(queue).toHaveCount(0);
    await send(page, '自动发送的后续消息');
    await expect(queue).toContainText('自动发送的后续消息');
    await request.post(`${fixtureUrl}/test/sidebar`, { data: { action: 'complete' } });
    await expect(queue).toHaveCount(0);
    await expect.poll(async () => (await state(request)).operations.filter((entry) => entry.operation === 'send')
      .at(-1)?.text).toBe('自动发送的后续消息');
  });

test('desktop web changes the Agent Hub home on the connected computer', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop');
  await request.post(fixtureUrl + '/test/reset');
  await login(page);
  await navigate(page, '聊天');
  await page.getByRole('button', { name: 'Agent Hub 设置', exact: true }).click();
  await page.getByRole('tab', { name: '数据目录' }).click();
  await expect(page.getByText('D:/AgentHub/.codex', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '选择新目录' }).click();
  const picker = page.getByRole('dialog', { name: '选择新目录', exact: true });
  await picker.getByRole('option', { name: /WorkData/ }).click();
  await picker.getByRole('button', { name: '选择文件夹', exact: true }).click();
  await page.getByRole('radio', { name: '从空目录开始' }).check();
  await page.screenshot({ path: info.outputPath('web-home-confirm.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '确认更换' }).click();
  await expect(page.getByText('下次启动时使用：D:/AgentHub/WorkData')).toBeVisible();
  await page.getByRole('button', { name: '撤销更换' }).click();
  await expect(page.getByRole('button', { name: '撤销更换' })).toHaveCount(0);
});
