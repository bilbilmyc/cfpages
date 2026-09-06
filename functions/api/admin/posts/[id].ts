import { HttpError, json, type Env } from '../../../../server/http';
import { renderPost } from '../../../../server/render-post';
import {
  adminColumns,
  postDB,
  postID,
  postInput,
  validatePost,
  snapshot,
  type PostRow,
} from '../../../../server/posts';
export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const row = await postDB(env)
    .prepare(`SELECT ${adminColumns} FROM posts WHERE id=?`)
    .bind(postID(params.id))
    .first();
  if (!row) throw new HttpError(404, '文章不存在。');
  return json(row);
};
export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  const id = postID(params.id),
    input = await postInput(request),
    fields = validatePost(input);
  if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 1)
    throw new HttpError(400, '文章版本无效。');
  if (!['save', 'publish', 'unpublish'].includes(String(input.action)))
    throw new HttpError(400, '文章操作无效。');
  if (input.action === 'publish' && !fields.body.trim())
    throw new HttpError(400, '写一些正文后再发布吧。');
  const db = postDB(env);
  const row = await db.prepare('SELECT * FROM posts WHERE id=?').bind(id).first<PostRow>();
  if (!row) throw new HttpError(404, '文章不存在。');
  const revision = Number(input.revision) + 1,
    now = new Date().toISOString();
  const date =
    input.action === 'publish'
      ? row.published_at || now
      : input.action === 'unpublish'
        ? null
        : row.published_at;
  const content =
    input.action === 'publish'
      ? JSON.stringify({ ...snapshot(fields, id, row.slug, date!), html: renderPost(fields.body) })
      : input.action === 'unpublish'
        ? null
        : row.published_content;
  const publishedRevision =
    input.action === 'publish'
      ? revision
      : input.action === 'unpublish'
        ? null
        : row.published_revision;
  const result = await db
    .prepare(
      'UPDATE posts SET title=?,summary=?,category=?,body=?,revision=?,published_revision=?,published_content=?,published_at=?,updated_at=? WHERE id=? AND revision=?',
    )
    .bind(
      fields.title,
      fields.summary,
      fields.category,
      fields.body,
      revision,
      publishedRevision,
      content,
      date,
      now,
      id,
      input.revision as number,
    )
    .run();
  if (!result.meta.changes)
    throw new HttpError(409, '文章已在其他窗口更新。请先导出当前文字，再重新打开文章，避免覆盖。');
  return json({
    ...fields,
    id,
    slug: row.slug,
    revision,
    published_revision: publishedRevision,
    published_at: date,
    updated_at: now,
  });
};
