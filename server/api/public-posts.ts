import { Hono } from 'hono';
import type { Env } from '../http';
import { json, HttpError } from '../http';
import { postDB, pagination } from '../posts';
const routes = new Hono<{ Bindings: Env }>({ strict: false });
routes.get('/', async (c) => {
  const env = c.env;
  const request = c.req.raw;
  const u = new URL(request.url),
    offset = pagination(u),
    query = u.searchParams.get('q')?.trim() || '';
  if (query.length > 100) throw new HttpError(400, '搜索词最多 100 个字符。');
  const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
  const { results } = await postDB(env)
    .prepare(
      `SELECT id,slug,json_extract(published_content,'$.title') AS title,json_extract(published_content,'$.summary') AS summary,json_extract(published_content,'$.category') AS category,json_extract(published_content,'$.date') AS date FROM posts WHERE published_at IS NOT NULL AND (?='' OR json_extract(published_content,'$.title') LIKE ? ESCAPE '\\' OR json_extract(published_content,'$.body') LIKE ? ESCAPE '\\' OR json_extract(published_content,'$.category') LIKE ? ESCAPE '\\') ORDER BY published_at DESC,id DESC LIMIT 21 OFFSET ?`,
    )
    .bind(query, pattern, pattern, pattern, offset)
    .all();
  return json({ posts: results.slice(0, 20), next: results.length > 20 ? offset + 20 : null });
});

routes.get('/:slug', async (c) => {
  const env = c.env;
  const params = c.req.param();
  const slug = params.slug;
  if (typeof slug !== 'string' || slug.length > 100)
    throw new HttpError(404, '文章不存在或尚未发布。');
  const row = await postDB(env)
    .prepare('SELECT published_content FROM posts WHERE slug=? AND published_at IS NOT NULL')
    .bind(slug)
    .first<{ published_content: string }>();
  if (!row) throw new HttpError(404, '文章不存在或尚未发布。');
  return json(JSON.parse(row.published_content));
});

export default routes;
