import { describe, expect, it } from 'vitest';
import { transform } from '../src/lib/transforms';
describe('local developer tools', () => {
  it('round-trips Unicode including emoji in Base64', async () => {
    const text = '你好，世界 🌱';
    const encoded = await transform('base64-encode', text);
    expect(await transform('base64-decode', encoded)).toBe(text);
  });
  it('rejects malformed JSON and Base64', async () => {
    await expect(transform('format', '{"a":1,}')).rejects.toThrow();
    await expect(transform('base64-decode', '%%%')).rejects.toThrow();
  });
  it('formats and compacts nested JSON', async () => {
    const compact = '{"a":[1,true,null]}';
    expect(await transform('minify', await transform('format', compact))).toBe(compact);
  });
  it('preserves URL parameter special characters', async () => {
    const input = 'a&b=你好 +/#?';
    expect(await transform('url-decode', await transform('url-encode', input))).toBe(input);
  });
  it('recognizes zero and negative timestamps', async () => {
    expect(await transform('timestamp', '0')).toContain('1970-01-01T00:00:00.000Z');
    expect(await transform('timestamp', '-1')).toContain('1969-12-31T23:59:59.000Z');
  });
  it('converts timezone and milliseconds consistently', async () => {
    expect(await transform('timestamp', '2026-09-06T12:00:00+08:00')).toContain(
      '2026-09-06T04:00:00.000Z',
    );
    const ms = '1788667200000';
    expect(await transform('timestamp', ms)).toContain(`毫秒：${ms}`);
  });
  it('rejects ambiguous dates and missing timezone', async () => {
    for (const text of ['', 'tomorrow', '2026-09-06', '2026-09-06T12:00:00'])
      await expect(transform('timestamp', text)).rejects.toThrow();
  });
  it('hashes against known SHA-256 vector', async () => {
    expect(await transform('sha256', 'abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
