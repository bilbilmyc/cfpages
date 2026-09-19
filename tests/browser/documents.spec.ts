import { expect, test, type Page, type APIRequestContext } from '@playwright/test';
const token = 'test-only-secret-with-at-least-32-characters';
const headers = { Authorization: `Bearer ${token}` };
async function login(page: Page) {
  await page.getByLabel('管理员密钥', { exact: true }).fill(token);
  await page.getByRole('button', { name: '连接文件库', exact: true }).click();
}
async function create(page: Page, kind: 'flow' | 'canvas', title: string) {
  await page.goto('/');
  await login(page);
  await page
    .getByRole('button', { name: kind === 'flow' ? '新建流程图' : '新建画布', exact: true })
    .click();
  await expect(page.getByLabel('文件名称', { exact: true })).toBeVisible();
  await page.getByLabel('文件名称', { exact: true }).fill(title);
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存名称', exact: true })).toBeDisabled();
  return page.url().split('/').at(-1)!;
}
async function document(request: APIRequestContext, id: string) {
  const response = await request.get(`/api/admin/documents/${id}`, { headers });
  expect(response.status()).toBe(200);
  return response.json();
}
async function savedNodes(request: APIRequestContext, id: string, count: number) {
  await expect
    .poll(async () => JSON.parse((await document(request, id)).content).nodes.length)
    .toBe(count);
}
async function draw(page: Page, x: number) {
  const box = await page.getByLabel('绘图画布，使用画笔或形状工具拖动绘制').boundingBox();
  if (!box) throw Error('Canvas not visible');
  await page.mouse.move(box.x + x, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + x + 30, box.y + 60, { steps: 4 });
  await page.mouse.up();
}
test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
});

test('file lifecycle: naming, independent duplicate, archive, restore and recent files', async ({
  page,
  request,
}) => {
  const title = `多文档流程 ${Date.now()}`;
  const id = await create(page, 'flow', title);
  await page.getByRole('button', { name: '添加节点', exact: true }).click();
  await savedNodes(request, id, 1);
  await page.getByRole('link', { name: '← 我的文件', exact: true }).click();
  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: title, exact: true }) });
  await row.getByRole('button', { name: '复制', exact: true }).click();
  const copied = page.getByRole('link', { name: title + ' 副本', exact: true });
  await expect(copied).toBeVisible();
  const copyId = (await copied.getAttribute('href'))!.split('/').at(-1)!;
  await row.getByRole('button', { name: '重命名', exact: true }).click();
  await page.getByLabel('新文件名称', { exact: true }).fill(title + ' 改名');
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  const renamed = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: title + ' 改名', exact: true }) });
  await renamed.getByRole('button', { name: '归档', exact: true }).click();
  await expect(page.getByRole('link', { name: title + ' 改名', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '已归档', exact: true }).click();
  await page.getByLabel('搜索文件', { exact: true }).fill(title);
  await renamed.getByRole('button', { name: '恢复', exact: true }).click();
  await page.getByRole('button', { name: '返回全部文件', exact: true }).click();
  await page.getByRole('link', { name: title + ' 改名', exact: true }).click();
  await expect(page.getByText('1 个节点 · 0 条连线', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '添加节点', exact: true }).click();
  await savedNodes(request, id, 2);
  expect(JSON.parse((await document(request, copyId)).content).nodes).toHaveLength(1);
  await page.getByRole('link', { name: '← 我的文件', exact: true }).click();
  await expect(
    page.getByRole('list', { name: '云端文件' }).getByRole('listitem').first(),
  ).toContainText(title + ' 改名');
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page
        .locator('.file-library')
        .evaluate((el) => el.getBoundingClientRect().right <= innerWidth),
    ).toBe(true);
    expect(
      await page.locator('.file-library').evaluate((el) =>
        Array.from(el.querySelectorAll('input,button,select')).every((node) => {
          const r = node.getBoundingClientRect();
          return r.left >= 0 && r.right <= innerWidth + 1;
        }),
      ),
    ).toBe(true);
  }
});

test('a second device resumes canvas and stale edits stop instead of overwriting', async ({
  page,
  browser,
  request,
}) => {
  const id = await create(page, 'canvas', `跨设备画布 ${Date.now()}`);
  await draw(page, 30);
  await expect.poll(async () => JSON.parse((await document(request, id)).content).length).toBe(1);
  const context = await browser.newContext(),
    other = await context.newPage();
  try {
    await other.goto(`/tools/canvas/${id}`);
    await login(other);
    await expect(other.getByText('1200 × 720 · 1 笔', { exact: true })).toBeVisible();
    await draw(other, 130);
    await expect.poll(async () => JSON.parse((await document(request, id)).content).length).toBe(2);
    const remote = (await document(request, id)).content;
    await draw(page, 230);
    await expect(
      page.getByRole('alert').filter({ hasText: '文件已在其他窗口修改或归档' }),
    ).toBeVisible();
    expect((await document(request, id)).content).toBe(remote);
    await page.getByRole('button', { name: '另存副本', exact: true }).click();
    await expect(page).not.toHaveURL(new RegExp(id));
    await expect(page.getByText('1200 × 720 · 2 笔', { exact: true })).toBeVisible();
    expect((await document(request, id)).content).toBe(remote);
  } finally {
    await context.close();
  }
});

test('slow document saves are serialized and never touch the singleton draft', async ({
  page,
  request,
}) => {
  const legacy = await (await request.get('/api/admin/drafts/flow', { headers })).json();
  const id = await create(page, 'flow', `慢保存 ${Date.now()}`);
  await page.route(`**/api/admin/documents/${id}`, async (route) => {
    if (route.request().method() === 'PUT')
      await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
  });
  const sending = page.waitForRequest(
    (r) => r.url().endsWith(`/documents/${id}`) && r.method() === 'PUT',
  );
  await page.getByRole('button', { name: '添加节点', exact: true }).click();
  await sending;
  await page.getByRole('button', { name: '添加节点', exact: true }).click();
  await savedNodes(request, id, 2);
  await expect(page.getByRole('alert')).toHaveCount(0);
  const after = await (await request.get('/api/admin/drafts/flow', { headers })).json();
  expect(after).toEqual(legacy);
});

test('failed saves survive reload and explicit recovery resumes safely', async ({
  page,
  request,
}) => {
  const id = await create(page, 'flow', `离线恢复 ${Date.now()}`);
  await page.route(`**/api/admin/documents/${id}`, async (route) => {
    if (route.request().method() === 'PUT')
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: '模拟断网，请稍后重试。' }),
      });
    else await route.continue();
  });
  await page.getByRole('button', { name: '添加节点', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '模拟断网' })).toBeVisible();
  await page.unroute(`**/api/admin/documents/${id}`);
  await page.reload();
  await expect(page.getByRole('button', { name: '连接文件库', exact: true })).toBeVisible();
  await login(page);
  await expect(page.getByText('发现这份文件的本机未同步内容。', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '恢复本机修改', exact: true }).click();
  await savedNodes(request, id, 1);
  await expect(page.getByText('1 个节点 · 0 条连线', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      (value) => Object.values(localStorage).some((item) => item.includes(value)),
      token,
    ),
  ).toBe(false);
  await expect
    .poll(() =>
      page.evaluate(
        (docId) =>
          Object.keys(localStorage).filter((key) =>
            key.startsWith(`studio-file-recovery:${docId}:`),
          ).length,
        id,
      ),
    )
    .toBe(0);
});

test('local scratch can become a named file without changing the scratch', async ({
  page,
  request,
}) => {
  await page.goto('/tools/flow');
  await page.getByRole('button', { name: '添加节点', exact: true }).click();
  await page.getByRole('button', { name: '存为新文件', exact: true }).click();
  await login(page);
  const title = `保存本地流程 ${Date.now()}`;
  await page.getByLabel('文件名称', { exact: true }).fill(title);
  await page.getByRole('button', { name: '保存为云端文件', exact: true }).click();
  await expect(page).toHaveURL(/\/tools\/flow\/[a-f0-9-]+$/);
  const id = page.url().split('/').at(-1)!;
  await savedNodes(request, id, 5);
  await page.getByRole('button', { name: '添加节点', exact: true }).click();
  await savedNodes(request, id, 6);
  await page
    .getByRole('navigation', { name: '主要导航' })
    .getByRole('link', { name: '流程图', exact: true })
    .click();
  await expect(page.getByText('5 个节点 · 3 条连线', { exact: true })).toBeVisible();
});
