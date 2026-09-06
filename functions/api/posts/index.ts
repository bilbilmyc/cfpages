import { json, HttpError, type Env } from '../../../server/http';
import { postDB, pagination } from '../../../server/posts';
export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
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
};
