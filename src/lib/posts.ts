export type PostFields = { title: string; summary: string; category: string; body: string };
export type PublicPost = PostFields & { id: string; slug: string; date: string };
export type PostSummary = Omit<PublicPost, 'body'>;
export type ManagedPost = PostFields & {
  id: string;
  slug: string;
  revision: number;
  published_revision: number | null;
  published_at: string | null;
  updated_at: string;
};
export type ManagedPostSummary = Pick<ManagedPost, 'id' | 'title' | 'published_at' | 'updated_at'>;
export async function requestJSON<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers });
  const data = (await response.json().catch(() => {
    throw Error('服务暂时无法连接，请稍后重试。');
  })) as { error?: string };
  if (!response.ok) throw Error(data.error || '请求失败，请稍后重试。');
  return data as T;
}
