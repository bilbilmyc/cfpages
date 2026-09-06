import { type Env } from '../../server/http';
export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  const headers = new Headers({
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  if (!['GET', 'HEAD'].includes(request.method))
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  if (!env.IMAGES) return new Response('Storage not configured', { status: 503, headers });
  const key = String(params.key);
  if (!/^[\da-f-]{36}\.(png|jpg|gif|webp)$/.test(key))
    return new Response('Not found', { status: 404, headers });
  try {
    const object =
      request.method === 'HEAD' ? await env.IMAGES.head(key) : await env.IMAGES.get(key);
    if (!object) return new Response('Not found', { status: 404, headers });
    object.writeHttpMetadata(headers);
    headers.set('ETag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=86400');
    if (request.headers.get('If-None-Match') === object.httpEtag)
      return new Response(null, { status: 304, headers });
    headers.set('Content-Length', String(object.size));
    return new Response(request.method === 'HEAD' ? null : (object as R2ObjectBody).body, {
      headers,
    });
  } catch {
    return new Response('Storage temporarily unavailable', { status: 503, headers });
  }
};
