import { Hono } from 'hono';
import type { Env } from '../http';
import { HttpError, json, limitedBody } from '../http';
const routes = new Hono<{ Bindings: Env }>({ strict: false });
const KEYS = new Set(['flow', 'canvas']);
const LIMIT = 2 * 1024 * 1024;
type Row = { content: string; revision: number; updated_at: string };
function draftDB(env: Env) {
  if (!env.DB) throw new HttpError(503, '草稿空间尚未连接，请配置 D1（DB）绑定后重新部署。');
  return env.DB;
}
function draftKey(value: unknown) {
  const key = String(value);
  if (!KEYS.has(key)) throw new HttpError(404, '没有这种工具草稿。');
  return key;
}
routes.get('/:key', async (c) => {
  const env = c.env;
  const params = c.req.param();
  const row = await draftDB(env)
    .prepare('SELECT content,revision,updated_at FROM tool_drafts WHERE id=?')
    .bind(draftKey(params.key))
    .first<Row>();
  return json(row ?? { content: null, revision: 0, updated_at: null });
});
routes.put('/:key', async (c) => {
  const request = c.req.raw;
  const env = c.env;
  const params = c.req.param();
  const key = draftKey(params.key),
    db = draftDB(env);
  if (!request.headers.get('Content-Type')?.includes('application/json'))
    throw new HttpError(415, '请使用 JSON 提交草稿。');
  const bytes = await limitedBody(request, LIMIT * 6 + 1024, '草稿请求过大。');
  const input = (() => {
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
  })() as {
    content?: unknown;
    revision?: unknown;
  } | null;
  if (!input || typeof input.content !== 'string') throw new HttpError(400, '草稿内容无效。');
  if (new TextEncoder().encode(input.content).byteLength > LIMIT)
    throw new HttpError(413, '草稿超过 2 MiB 限制。');
  try {
    if (JSON.parse(input.content) === null) throw Error();
  } catch {
    throw new HttpError(400, '草稿内容不是有效的 JSON。');
  }
  const expected = input.revision;
  if (typeof expected !== 'number' || !Number.isSafeInteger(expected) || expected < 0)
    throw new HttpError(400, '草稿版本无效。');
  const now = new Date().toISOString();
  if (expected === 0) {
    const created = await db
      .prepare(
        'INSERT INTO tool_drafts(id,content,revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(id) DO NOTHING',
      )
      .bind(key, input.content, now)
      .run();
    if (!created.meta.changes)
      throw new HttpError(409, '云端已有这份草稿。请先重新打开页面读取云端内容，避免覆盖。');
    return json({ revision: 1, updated_at: now }, 201);
  }
  const result = await db
    .prepare('UPDATE tool_drafts SET content=?,revision=?,updated_at=? WHERE id=? AND revision=?')
    .bind(input.content, expected + 1, now, key, expected)
    .run();
  if (!result.meta.changes)
    throw new HttpError(409, '云端草稿已在其他窗口更新。请先重新打开页面读取云端内容，避免覆盖。');
  return json({ revision: expected + 1, updated_at: now });
});

export default routes;
