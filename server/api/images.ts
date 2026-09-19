import { Hono } from 'hono';
import type { Env } from '../http';
import { resources, json, limitedBody, imageType, imageURL, HttpError } from '../http';
const routes = new Hono<{ Bindings: Env }>({ strict: false });
routes.get('/', async (c) => {
  const request = c.req.raw;
  const env = c.env;
  const { db } = resources(env);
  const u = new URL(request.url);
  const cursor = u.searchParams.get('before');
  if (cursor && !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\|[\da-f-]{36}$/.test(cursor))
    throw new HttpError(400, '无效的分页游标。');
  const [date, id] = cursor?.split('|') || [];
  const statement = cursor
    ? db
        .prepare(
          'SELECT * FROM images WHERE deleted_at IS NULL AND (created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT 31',
        )
        .bind(date, date, id)
    : db.prepare(
        'SELECT * FROM images WHERE deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 31',
      );
  const { results } = await statement.all<{
    id: string;
    object_key: string;
    filename: string;
    mime: string;
    size: number;
    created_at: string;
  }>();
  const page = results.slice(0, 30);
  const last = page.at(-1);
  return json({
    images: page.map((row) => ({ ...row, url: imageURL(request, row.object_key, env) })),
    next: results.length > 30 && last ? `${last.created_at}|${last.id}` : null,
  });
});
routes.post('/', async (c) => {
  const request = c.req.raw;
  const env = c.env;
  const { db, bucket } = resources(env);
  const body = await limitedBody(request, 8 * 1024 * 1024);
  const type = imageType(body);
  if (!type) throw new HttpError(415, '仅支持 PNG、JPEG、GIF、WebP 图片，不接受 SVG 或其他文件。');
  let filename = 'image';
  try {
    filename = decodeURIComponent(request.headers.get('X-Filename') || 'image');
  } catch {
    throw new HttpError(400, '文件名编码无效。');
  }
  filename = filename.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200) || 'image';
  const id = crypto.randomUUID();
  const key = `${id}.${type.extension}`;
  await bucket.put(key, body, {
    httpMetadata: { contentType: type.mime, cacheControl: 'public, max-age=86400' },
    customMetadata: { id },
  });
  try {
    await db
      .prepare('INSERT INTO images (id,object_key,filename,mime,size) VALUES (?,?,?,?,?)')
      .bind(id, key, filename, type.mime, body.length)
      .run();
  } catch (error) {
    await bucket.delete(key);
    throw error;
  }
  return json(
    {
      id,
      object_key: key,
      filename,
      mime: type.mime,
      size: body.length,
      url: imageURL(request, key, env),
      created_at: new Date().toISOString(),
    },
    201,
  );
});

// Soft delete preserves the object and makes the library entry recoverable.
routes.delete('/:id', async (c) => {
  const request = c.req.raw;
  const env = c.env;
  const params = c.req.param();
  const { db } = resources(env);
  const id = String(params.id);
  if (!/^[\da-f-]{36}$/.test(id)) throw new HttpError(400, '无效的图片编号。');
  await db
    .prepare(
      "UPDATE images SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(id)
    .run();
  return json({ ok: true });
});
routes.post('/:id', async (c) => {
  const request = c.req.raw;
  const env = c.env;
  const params = c.req.param();
  const { db } = resources(env);
  const id = String(params.id);
  if (!/^[\da-f-]{36}$/.test(id)) throw new HttpError(400, '无效的图片编号。');
  await db.prepare('UPDATE images SET deleted_at = NULL WHERE id = ?').bind(id).run();
  return json({ ok: true });
});

export default routes;
