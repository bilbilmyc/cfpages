import { authorize, resources, json, HttpError, type Env } from '../../../server/http';
// Soft delete preserves the object and makes the library entry recoverable.
export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  await authorize(request, env);
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
};
export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  await authorize(request, env);
  const { db } = resources(env);
  const id = String(params.id);
  if (!/^[\da-f-]{36}$/.test(id)) throw new HttpError(400, '无效的图片编号。');
  await db.prepare('UPDATE images SET deleted_at = NULL WHERE id = ?').bind(id).run();
  return json({ ok: true });
};
