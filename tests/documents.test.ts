import { describe, it, expect } from 'vitest';
import api from '../server/api/app';
import { validDiagram, validStrokes } from '../src/lib/toolDocumentData';
const env = { ADMIN_TOKEN: 'test-only-secret-with-at-least-32-characters', DB: {} as D1Database };
const headers = { Authorization: `Bearer ${env.ADMIN_TOKEN}`, 'Content-Type': 'application/json' };
describe('document validation before storage access', () => {
  const create = (body: unknown) =>
    api.request(
      '/api/admin/documents',
      { method: 'POST', headers, body: JSON.stringify(body) },
      env,
    );
  it('rejects type mismatches, blank names and control characters', async () => {
    for (const title of ['', ' ', '\nprivate', 'a'.repeat(81), 42])
      expect(
        (await create({ kind: 'flow', title, content: '{"nodes":[],"edges":[]}' })).status,
      ).toBe(400);
    expect(
      (await create({ kind: 'canvas', title: 'x', content: '{"nodes":[],"edges":[]}' })).status,
    ).toBe(400);
  });
  it('enforces UTF-8 bytes and announced request bounds', async () => {
    expect(
      (
        await create({
          kind: 'flow',
          title: 'x',
          content: JSON.stringify({ nodes: [], edges: [], extra: '中'.repeat(700000) }),
        })
      ).status,
    ).toBe(413);
    const r = await api.request(
      '/api/admin/documents',
      { method: 'POST', headers: { ...headers, 'Content-Length': '99999999' }, body: '{}' },
      env,
    );
    expect(r.status).toBe(413);
  });
  it('rejects invalid diagrams and unsafe canvas coordinates', () => {
    expect(
      validDiagram({
        nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'x' } }],
        edges: [{ id: 'e', source: '1', target: 'missing' }],
      }),
    ).toBe(false);
    expect(
      validStrokes([{ kind: 'pen', color: '#2c503e', width: 4, points: [{ x: Infinity, y: 2 }] }]),
    ).toBe(false);
    expect(
      validStrokes([
        {
          kind: 'rect',
          color: '#2c503e',
          width: 4,
          points: [
            { x: 10, y: 20 },
            { x: 100, y: 120 },
          ],
        },
      ]),
    ).toBe(true);
  });
  it('protects new endpoints before touching bindings', async () => {
    for (const path of [
      '/api/admin/documents',
      '/api/admin/documents/legacy-flow',
      '/api/admin/documents/import-legacy',
    ])
      expect((await api.request(path, {}, env)).status).toBe(401);
  });
});
