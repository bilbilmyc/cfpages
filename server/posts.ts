import { HttpError, limitedBody, type Env } from './http';
import type { PostFields, ManagedPost, PublicPost } from '../src/lib/posts';
export function postDB(env: Env) {
  if (!env.DB) throw new HttpError(503, '文章数据库尚未连接。');
  return env.DB;
}
export function postID(id: unknown): string {
  if (typeof id !== 'string' || !/^[a-f\d-]{36}$/.test(id))
    throw new HttpError(400, '文章编号无效。');
  return id;
}
export function validatePost(value: unknown): PostFields {
  if (!value || typeof value !== 'object') throw new HttpError(400, '文章数据无效。');
  const input = value as Record<string, unknown>;
  const field = (key: string, max: number, required = false) => {
    if (typeof input[key] !== 'string') throw new HttpError(400, '文章字段格式无效。');
    const text = key === 'body' ? (input[key] as string) : (input[key] as string).trim();
    if (text.length > max || (required && !text))
      throw new HttpError(400, '请检查标题、分类和正文长度。');
    return text;
  };
  return {
    title: field('title', 120, true),
    summary: field('summary', 300),
    category: field('category', 40, true),
    body: field('body', 100000),
  };
}
export async function postInput(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('Content-Type')?.includes('application/json'))
    throw new HttpError(415, '请使用 JSON 提交文章。');
  const bytes = await limitedBody(request, 512 * 1024, '文章数据超过 512 KiB 限制。');
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error();
    return value;
  } catch {
    throw new HttpError(400, '文章数据不是有效 JSON。');
  }
}
export type PostRow = ManagedPost & { published_content: string | null; created_at: string };
export const adminColumns =
  'id,slug,title,summary,category,body,revision,published_revision,published_at,updated_at';
export function snapshot(row: PostFields, id: string, slug: string, date: string): PublicPost {
  return { ...row, id, slug, date: date.slice(0, 10) };
}
export function pagination(url: URL) {
  const raw = url.searchParams.get('offset') || '0';
  if (!/^\d{1,6}$/.test(raw)) throw new HttpError(400, '分页参数无效。');
  return Number(raw);
}
