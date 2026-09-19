import { expect, test } from '@playwright/test';

const token = 'test-only-secret-with-at-least-32-characters';
test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
});

test('quick JSON handles valid/invalid input and links to a selected tool', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('JSON 内容').fill('{"name":"中文","count":2}');
  await page.getByRole('button', { name: '格式化', exact: true }).click();
  await expect(page.getByLabel('JSON 内容')).toHaveValue('{\n  "name": "中文",\n  "count": 2\n}');
  await page.getByRole('button', { name: '压缩', exact: true }).click();
  await expect(page.getByLabel('JSON 内容')).toHaveValue('{"name":"中文","count":2}');
  await page.getByLabel('JSON 内容').fill('invalid');
  await page.getByRole('button', { name: '格式化', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('link', { name: 'Base64 中文与 UTF-8 编解码' }).click();
  await expect(page).toHaveURL(/tool=base64/);
  await expect(page.getByRole('button', { name: 'Base64', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByLabel('输入', { exact: true }).fill('你好');
  await page.getByRole('button', { name: '编码', exact: true }).click();
  await expect(page.getByLabel('结果', { exact: true })).toHaveValue('5L2g5aW9');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Base64', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('flow nodes persist locally and export real JSON', async ({ page }) => {
  await page.goto('/tools/flow');
  await page.getByLabel('节点文字').fill('浏览器验证节点');
  await page.getByRole('button', { name: '添加节点', exact: true }).click();
  await expect(page.getByText('5 个节点 · 3 条连线')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
  await page.getByRole('link', { name: '工作台', exact: true }).click();
  await page
    .getByRole('navigation', { name: '主要导航' })
    .getByRole('link', { name: '流程图', exact: true })
    .click();
  await expect(page.getByText('5 个节点 · 3 条连线')).toBeVisible();
});

test('canvas draws, undoes, redoes and exports PNG', async ({ page }) => {
  await page.goto('/tools/canvas');
  const canvas = page.getByLabel('绘图画布，使用画笔或形状工具拖动绘制');
  await expect(canvas).toBeVisible();
  const rect = await canvas.boundingBox();
  if (!rect) throw Error('Canvas is not laid out');
  await page.mouse.move(rect.x + 40, rect.y + 40);
  await page.mouse.down();
  await page.mouse.move(rect.x + 120, rect.y + 90, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText('1200 × 720 · 1 笔')).toBeVisible();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByText('1200 × 720 · 0 笔')).toBeVisible();
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(page.getByText('1200 × 720 · 1 笔')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PNG', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('canvas.png');
});

test('owner can save a private draft, publish, update privately and unpublish', async ({
  page,
  request,
}) => {
  await page.goto('/admin');
  await page.getByLabel('管理员密钥').fill(token);
  await page.getByRole('button', { name: '登录管理后台' }).click();
  await page.getByRole('button', { name: '新建文章', exact: true }).click();
  const title = '浏览器验收 ' + Date.now();
  await page.getByLabel('文章标题', { exact: true }).fill(title);
  await page.getByLabel('正文', { exact: true }).fill('公开正文，仅用于本地测试。');
  const created = page.waitForResponse(
    (r) => r.url().endsWith('/api/admin/posts') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  const post = await (await created).json();
  await expect(page.getByRole('status').filter({ hasText: '草稿已保存到云端。' })).toBeVisible();
  expect((await request.get('/api/posts/' + post.slug)).status()).toBe(404);
  await page.getByRole('button', { name: '发布文章', exact: true }).click();
  await expect(page.getByText('文章已发布，访客现在可以阅读。')).toBeVisible();
  expect((await (await request.get('/api/posts/' + post.slug)).json()).body).toContain('公开正文');
  await page.getByLabel('正文', { exact: true }).fill('私有修改不能出现在公开版本。');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByText('草稿已保存到云端，公开版本保持不变。')).toBeVisible();
  expect((await (await request.get('/api/posts/' + post.slug)).json()).body).toContain('公开正文');
  await page.getByRole('button', { name: '撤下文章', exact: true }).click();
  await expect(page.getByText('文章已撤下，草稿保留。')).toBeVisible();
  expect((await request.get('/api/posts/' + post.slug)).status()).toBe(404);
  await page.reload();
  await expect(page.getByRole('heading', { name: '站主登录' })).toBeVisible();
});

test('pages remain usable at phone, tablet and desktop widths', async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const width of [320, 375, 414, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      '/',
      '/tools/dev',
      '/tools/flow',
      '/tools/canvas',
      '/journal',
      '/about',
      '/admin',
    ]) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('h1')).toBeVisible();
      const overflow = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll(
            'main button, main input, main textarea, main canvas, header nav a',
          ),
        )
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
          })
          .map((el) => el.outerHTML.slice(0, 180)),
      );
      expect(overflow, route + ' at ' + width).toEqual([]);
    }
  }
  expect(errors).toEqual([]);
});

test('cloud sync can retry login and serializes edits during slow saves', async ({
  page,
  request,
}) => {
  await page.goto('/tools/flow');
  await page.getByRole('button', { name: '云同步', exact: true }).click();
  await page.getByLabel('管理员密钥').fill('incorrect-token-with-at-least-32-characters');
  await page.getByRole('button', { name: '连接云端', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('管理员密钥')).toBeVisible();
  await page.getByLabel('管理员密钥').fill(token);
  await page.getByRole('button', { name: '连接云端', exact: true }).click();
  await expect(page.getByRole('button', { name: '断开云同步', exact: true })).toBeVisible();
  const before = await (
    await request.get('/api/admin/drafts/flow', { headers: { Authorization: 'Bearer ' + token } })
  ).json();
  const count = JSON.parse(before.content).nodes.length;
  await page.route('**/api/admin/drafts/flow', async (route) => {
    if (route.request().method() === 'PUT')
      await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  const saving = page.waitForRequest(
    (r) => r.url().endsWith('/drafts/flow') && r.method() === 'PUT',
  );
  await page.getByRole('button', { name: '添加节点', exact: true }).click();
  await saving;
  await page.getByRole('button', { name: '添加节点', exact: true }).click();
  await expect
    .poll(
      async () => {
        const draft = await (
          await request.get('/api/admin/drafts/flow', {
            headers: { Authorization: 'Bearer ' + token },
          })
        ).json();
        return JSON.parse(draft.content).nodes.length;
      },
      { timeout: 10000 },
    )
    .toBe(count + 2);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('studio-tool-sync-token'))).toBeNull();
  await page.getByRole('button', { name: '断开云同步', exact: true }).click();
  await expect(page.getByRole('button', { name: '云同步', exact: true })).toBeVisible();
});

test('keyboard users can skip navigation to the workspace', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  // Route focus can place initial focus at main; explicitly focus the skip link.
  await page.getByRole('link', { name: '跳到主要内容' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('owner editor and image manager fit narrow screens', async ({ page }) => {
  await page.goto('/admin');
  await page.getByLabel('管理员密钥').fill(token);
  await page.getByRole('button', { name: '登录管理后台' }).click();
  await page.getByRole('button', { name: '新建文章', exact: true }).click();
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByLabel('文章标题', { exact: true })).toBeVisible();
    const overflow = await page.locator('main').evaluate(main => Array.from(main.querySelectorAll('button,input,textarea')).filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
    }).map(el => el.outerHTML.slice(0, 160)));
    expect(overflow, 'editor at ' + width).toEqual([]);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole('link', { name: '图片管理', exact: true }).click();
  await expect(page.getByRole('heading', { name: '图片管理', exact: true })).toBeVisible();
  expect(await page.locator('main').evaluate(el => el.getBoundingClientRect().right <= innerWidth)).toBe(true);
});
