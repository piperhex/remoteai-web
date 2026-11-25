import { expect, test } from '@playwright/test';
import { connect, fixtureUrl, login, openChatList, screenshot } from './chat-helpers';

const error = { message: 'unexpected status 502 Bad Gateway, url: http://127.0.0.1:51524/responses' };
const threadId = 'demo-chat';
const turnId = 'scoped-error';

test('keeps reply errors inside the conversation and out of a new chat', async ({ page, request }, info) => {
  await request.post(`${fixtureUrl}/test/reset`);
  await login(page);
  await connect(page);
  await openChatList(page);
  await page.getByText('移动端聊天体验', { exact: true }).click();
  await expect(page.getByRole('heading', { name: '移动端聊天体验', exact: true })).toBeVisible();
  await request.post(`${fixtureUrl}/test/chat-event`, { data: { method: 'turn/started', params: {
    threadId, turn: { id: turnId, status: 'inProgress', items: [
      { id: 'scoped-question', type: 'userMessage', text: '检查连接。' },
    ] },
  } } });
  const failure = { method: 'error', params: { threadId, turnId, error, willRetry: false } };
  await request.post(`${fixtureUrl}/test/chat-event`, { data: failure });
  await expect(page.locator('.chat-turn-error')).toContainText('本次回复遇到问题，已中断。');
  await expect(page.locator('.chat-error')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(error.message);
  await screenshot(page, info, `${info.project.name}-error-inside-conversation`);
  await openChatList(page);
  await page.getByRole('button', { name: '新聊天', exact: true }).click();
  await expect(page.getByRole('heading', { name: '新聊天', exact: true })).toBeVisible();
  await request.post(`${fixtureUrl}/test/chat-event`, { data: failure });
  await expect(page.getByRole('heading', { name: '想一起完成什么？', exact: true })).toBeVisible();
  await expect(page.locator('.chat-error, .chat-turn-error')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(error.message);
  await screenshot(page, info, `${info.project.name}-new-chat-clean`);
});

for (const failure of [
  { name: 'connection', message: error.message, notice: '连接暂时中断，Codex 正在重试…' },
  { name: 'capacity', message: 'Selected model is at capacity. Please try a different model.',
    notice: '当前模型繁忙，请换个模型重试。' },
]) test(`shows ${failure.name} failures outside work and before summaries until recovery`, async ({ page, request }, info) => {
  await request.post(`${fixtureUrl}/test/reset`);
  await login(page);
  await connect(page);
  await openChatList(page);
  await page.getByText('移动端聊天体验', { exact: true }).click();
  await expect(page.getByRole('heading', { name: '移动端聊天体验', exact: true })).toBeVisible();
  const emit = (method: string, params: Record<string, unknown>) =>
    request.post(`${fixtureUrl}/test/chat-event`, { data: { method, params: { threadId, ...params } } });
  await emit('turn/started', { turn: { id: turnId, status: 'inProgress', items: [
    { id: 'question', type: 'userMessage', text: '检查项目修改。' },
    { id: 'before', type: 'agentMessage', phase: 'commentary', text: '这是报错前的处理过程。' },
    { id: 'command', type: 'commandExecution', command: 'git status', status: 'completed', exitCode: 0 },
    ...(failure.name === 'connection' ? [{ id: 'reasoning', type: 'reasoning', summary: [] }] : []),
  ], plan: [{ step: '检查项目修改', status: 'inProgress' }] } });
  await emit('error', { turnId, willRetry: true,
    error: { message: failure.message } });
  await emit('item/started', { turnId, item: { id: 'reasoning', type: 'reasoning', summary: [] } });
  const notice = page.getByText(failure.notice, { exact: true });
  await expect(notice).toBeVisible();
  await expect(notice).toHaveCount(1);
  expect(await notice.evaluate(element => element.closest('.chat-entry-error')?.parentElement
    ?.classList.contains('chat-message-content'))).toBe(true);
  const plan = page.getByRole('button', { name: '查看任务计划', exact: true });
  await expect(plan).toBeVisible();
  expect((await notice.boundingBox())!.y).toBeLessThan((await plan.boundingBox())!.y);
  expect(await notice.evaluate(element => Boolean(element.closest('details, .chat-turn-summary')))).toBe(false);
  await screenshot(page, info, `${info.project.name}-${failure.name}-at-process-boundary`);
  if (failure.name === 'connection') {
    await page.getByRole('button', { name: '查看报错详情', exact: true }).click();
    await expect(page.locator('.chat-detail-stack')).toContainText(failure.message);
    await screenshot(page, info, `${info.project.name}-connection-details`);
  }
  await emit('item/completed', { turnId,
    item: { id: 'reasoning', type: 'reasoning', summary: ['连接恢复，继续检查。'] } });
  await expect(notice).toHaveCount(0);
  await expect(page.locator('.chat-detail-stack')).toHaveCount(0);
  await screenshot(page, info, `${info.project.name}-${failure.name}-recovered`);
});
