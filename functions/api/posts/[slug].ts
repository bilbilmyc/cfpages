import { json, HttpError, type Env } from '../../../server/http';
import { postDB } from '../../../server/posts';
export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const slug = params.slug;
  if (typeof slug !== 'string' || slug.length > 100)
    throw new HttpError(404, '文章不存在或尚未发布。');
  const row = await postDB(env)
    .prepare('SELECT published_content FROM posts WHERE slug=? AND published_at IS NOT NULL')
    .bind(slug)
    .first<{ published_content: string }>();
  if (!row) throw new HttpError(404, '文章不存在或尚未发布。');
  return json(JSON.parse(row.published_content));
};
