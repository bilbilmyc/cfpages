import { Hono } from 'hono';
import { authorize, HttpError, json, type Env } from '../http';
import publicPosts from './public-posts';
import adminPosts from './admin-posts';
import images from './images';
import drafts from './drafts';
import documents from './documents';

/** The API is transport-independent; Pages only forwards Request + bindings. */
export const api = new Hono<{ Bindings: Env }>({ strict: false }).basePath('/api');

api.onError((error) => {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  console.error('API failure', error.name);
  return json({ error: '服务暂时不可用，请稍后重试。' }, 500);
});

api.use('*', async (c, next) => {
  const path = c.req.path;
  if (/^\/api\/(admin|images)(?:\/|$)/.test(path)) await authorize(c.req.raw, c.env);
  await next();
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
});

api.get('/status', (c) =>
  json({
    configured: Boolean(
      c.env.DB && c.env.IMAGES && c.env.ADMIN_TOKEN && c.env.ADMIN_TOKEN.length >= 32,
    ),
  }),
);
api.get('/admin/session', () => json({ authenticated: true }));
api.route('/posts', publicPosts);
api.route('/admin/posts', adminPosts);
api.route('/images', images);
api.route('/admin/drafts', drafts);
api.route('/admin/documents', documents);
api.notFound(() => json({ error: '接口不存在或不支持此请求方法。' }, 404));

export default api;
