import { json, type Env } from '../../../../server/http';
import { postDB, postInput, validatePost, pagination } from '../../../../server/posts';
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const u = new URL(request.url),
    offset = pagination(u);
  const { results } = await postDB(env)
    .prepare(
      'SELECT id,title,published_at,updated_at FROM posts ORDER BY updated_at DESC,id DESC LIMIT 21 OFFSET ?',
    )
    .bind(offset)
    .all();
  return json({ posts: results.slice(0, 20), next: results.length > 20 ? offset + 20 : null });
};
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fields = validatePost(await postInput(request));
  const id = crypto.randomUUID(),
    slug = `note-${id}`,
    now = new Date().toISOString();
  await postDB(env)
    .prepare(
      'INSERT INTO posts(id,slug,title,summary,category,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
    )
    .bind(id, slug, fields.title, fields.summary, fields.category, fields.body, now, now)
    .run();
  return json(
    {
      ...fields,
      id,
      slug,
      revision: 1,
      published_revision: null,
      published_at: null,
      updated_at: now,
    },
    201,
  );
};
