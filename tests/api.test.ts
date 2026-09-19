import { describe, expect, it } from 'vitest';
import api from '../server/api/app';
import type { Env } from '../server/http';

const token = 'test-only-secret-with-at-least-32-characters';
const env: Env = { ADMIN_TOKEN: token, DB: {} as D1Database };
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
describe('Hono API boundary', () => {
  it('protects every administrative route before accessing storage', async () => {
    for (const path of [
      '/admin/session',
      '/admin/posts',
      '/admin/posts/test',
      '/admin/drafts/flow',
      '/images',
      '/images/test',
    ]) {
      const response = await api.request(`/api${path}`, {}, env);
      expect(response.status).toBe(401);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(await response.json()).toHaveProperty('error');
    }
  });
  it('fails closed without credentials and rejects another origin', async () => {
    expect((await api.request('/api/admin/session', { headers: auth }, {})).status).toBe(503);
    expect(
      (
        await api.request(
          '/api/admin/session',
          { headers: { ...auth, Origin: 'https://untrusted.test' } },
          env,
        )
      ).status,
    ).toBe(403);
    expect((await api.request('/api/admin/session', { headers: auth }, env)).status).toBe(200);
  });
  it('returns JSON for unknown routes instead of the website shell', async () => {
    const response = await api.request('/api/missing', {}, env);
    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('application/json');
  });
  it('uses the same error boundary for database failures', async () => {
    const response = await api.request('/api/posts', {}, {});
    expect(response.status).toBe(503);
    expect(await response.json()).toHaveProperty('error');
  });
});

describe('cloud draft validation before writes', () => {
  const put = (body: unknown, headers = auth) =>
    api.request(
      '/api/admin/drafts/flow',
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      },
      env,
    );
  it('rejects missing, coerced and non-integer versions', async () => {
    for (const revision of [undefined, null, true, '0', -1, 1.5]) {
      expect((await put({ content: '{}', revision })).status).toBe(400);
    }
  });
  it('measures the UTF-8 content limit, not JS string length', async () => {
    expect(
      (await put({ content: JSON.stringify({ text: '中'.repeat(700000) }), revision: 0 })).status,
    ).toBe(413);
  });
  it('rejects invalid JSON content and wrong media types', async () => {
    expect((await put({ content: 'not json', revision: 0 })).status).toBe(400);
    expect(
      (await put({ content: '{}', revision: 0 }, { ...auth, 'Content-Type': 'text/plain' })).status,
    ).toBe(415);
  });
  it('bounds the incoming request before parsing it', async () => {
    const response = await api.request(
      '/api/admin/drafts/flow',
      { method: 'PUT', headers: { ...auth, 'Content-Length': '99999999' }, body: '{}' },
      env,
    );
    expect(response.status).toBe(413);
  });
});
