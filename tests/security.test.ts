import { describe, expect, it } from 'vitest';
import { authorize, imageType, limitedBody, resources, imageURL } from '../server/http';
const token = 'test-only-secret-with-at-least-32-characters';
describe('image API security boundaries', () => {
  it('fails closed without configured secret or bindings', async () => {
    await expect(authorize(new Request('https://site.test/api/images'), {})).rejects.toMatchObject({
      status: 503,
    });
    expect(() => resources({})).toThrow();
  });
  it('requires the correct token', async () => {
    for (const wrong of ['', 'wrong', token + 'x'])
      await expect(
        authorize(
          new Request('https://site.test/api/images', {
            headers: { Authorization: `Bearer ${wrong}` },
          }),
          { ADMIN_TOKEN: token },
        ),
      ).rejects.toMatchObject({ status: 401 });
    await expect(
      authorize(
        new Request('https://site.test/api/images', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        { ADMIN_TOKEN: token },
      ),
    ).resolves.toBeUndefined();
  });
  it('rejects cross-origin management even with correct token', async () => {
    await expect(
      authorize(
        new Request('https://site.test/api/images', {
          headers: { Authorization: `Bearer ${token}`, Origin: 'https://untrusted.test' },
        }),
        { ADMIN_TOKEN: token },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('rejects SVG, HTML, and empty data independent of declared MIME', () => {
    for (const content of [
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      '<html><script>alert(1)</script></html>',
      '',
    ])
      expect(imageType(new TextEncoder().encode(content))).toBeNull();
  });
  it('recognizes allowed image signatures', () => {
    expect(imageType(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]))?.mime).toBe(
      'image/png',
    );
    expect(imageType(new TextEncoder().encode('RIFF1234WEBPabcdef'))?.mime).toBe('image/webp');
  });
  it('enforces the limit even without Content-Length', async () => {
    const req = new Request('https://site.test/api/images', { method: 'POST', body: '123456789' });
    await expect(limitedBody(req, 8)).rejects.toMatchObject({ status: 413 });
  });
  it('allows bounded bodies and rejects oversized announced length', async () => {
    expect(
      await limitedBody(new Request('https://site.test', { method: 'POST', body: '123' }), 3),
    ).toEqual(new TextEncoder().encode('123'));
    await expect(
      limitedBody(
        new Request('https://site.test', {
          method: 'POST',
          body: '123',
          headers: { 'Content-Length': '999' },
        }),
        8,
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
  it('does not put an unsafe public base in generated links', () => {
    const req = new Request('https://site.test');
    expect(imageURL(req, 'id.png', { IMAGE_PUBLIC_BASE: 'javascript:alert(1)' })).toBe(
      'https://site.test/images/id.png',
    );
    expect(imageURL(req, 'id.png', { IMAGE_PUBLIC_BASE: 'https://images.site.test/' })).toBe(
      'https://images.site.test/id.png',
    );
  });
});
