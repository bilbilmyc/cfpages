export interface Env {
  DB?: D1Database;
  IMAGES?: R2Bucket;
  ADMIN_TOKEN?: string;
  IMAGE_PUBLIC_BASE?: string;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
export async function authorize(request: Request, env: Env) {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32)
    throw new HttpError(
      503,
      '管理员凭据尚未配置，请在 Pages 设置中添加至少 32 位 ADMIN_TOKEN 密钥。',
    );
  const header = request.headers.get('Authorization') || '';
  const received = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (received.length > 512) throw new HttpError(401, '管理员凭据不正确。');
  const digest = (s: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  const [a, b] = await Promise.all([digest(received), digest(env.ADMIN_TOKEN)]);
  const aa = new Uint8Array(a),
    bb = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < aa.length; i++) difference |= aa[i] ^ bb[i];
  if (difference !== 0) throw new HttpError(401, '管理员凭据不正确。');
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, '不允许跨站管理请求。');
}
export function resources(env: Env): { db: D1Database; bucket: R2Bucket } {
  if (!env.DB || !env.IMAGES)
    throw new HttpError(503, '图片空间尚未连接，请配置 D1（DB）和 R2（IMAGES）绑定后重新部署。');
  return { db: env.DB, bucket: env.IMAGES };
}
export async function limitedBody(request: Request, limit: number) {
  const size = Number(request.headers.get('Content-Length'));
  if (size > limit) throw new HttpError(413, '文件超过 8 MiB 限制。');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, '没有收到图片内容。');
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new HttpError(413, '文件超过 8 MiB 限制。');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
export function imageType(b: Uint8Array): { mime: string; extension: string } | null {
  if (b.length < 12) return null;
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v))
    return { mime: 'image/png', extension: 'png' };
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return { mime: 'image/jpeg', extension: 'jpg' };
  const ascii = (start: number, end: number) => String.fromCharCode(...b.slice(start, end));
  if (['GIF87a', 'GIF89a'].includes(ascii(0, 6))) return { mime: 'image/gif', extension: 'gif' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP')
    return { mime: 'image/webp', extension: 'webp' };
  return null;
}
export function imageURL(request: Request, key: string, env: Env) {
  const base = env.IMAGE_PUBLIC_BASE?.replace(/\/$/, '');
  if (base) {
    try {
      const u = new URL(base);
      if (u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash)
        return `${base}/${key}`;
    } catch {
      /* fall back to same origin */
    }
  }
  return `${new URL(request.url).origin}/images/${key}`;
}
