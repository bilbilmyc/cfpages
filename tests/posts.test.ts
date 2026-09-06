import { describe, it, expect } from 'vitest';
import { validatePost, postInput } from '../server/posts';
import { renderPost } from '../server/render-post';
describe('article input boundary', () => {
  it('renders Markdown without executable HTML or script links', () => {
    const html = renderPost('## 标题\n\n<script>alert(1)</script>\n\n[click](javascript:alert(1))');
    expect(html).toContain('<h2>标题</h2>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
  });
  const fields = { title: ' 标题 ', summary: '摘要', category: '技术', body: '正文' };
  it('requires a real title and category', () => {
    expect(validatePost(fields).title).toBe('标题');
    expect(validatePost({ ...fields, body: '    indented code\n' }).body).toBe(
      '    indented code\n',
    );
    expect(() => validatePost({ ...fields, title: ' ' })).toThrow();
    expect(() => validatePost({ ...fields, category: null })).toThrow();
  });
  it('bounds article text and discards injected metadata', () => {
    expect(() => validatePost({ ...fields, body: 'a'.repeat(100001) })).toThrow();
    expect(
      validatePost({ ...fields, published_content: 'private', revision: 999 }),
    ).not.toHaveProperty('published_content');
  });
  it('rejects malformed JSON and unsupported content types', async () => {
    await expect(
      postInput(
        new Request('https://site.test', {
          method: 'POST',
          body: 'bad',
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      postInput(new Request('https://site.test', { method: 'POST', body: '{}' })),
    ).rejects.toThrow();
  });
  it('bounds streaming bodies even without Content-Length', async () => {
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(512 * 1024 + 1));
        c.close();
      },
    });
    await expect(
      postInput(
        new Request('https://site.test', {
          method: 'POST',
          body: stream,
          duplex: 'half',
          headers: { 'Content-Type': 'application/json' },
        } as RequestInit),
      ),
    ).rejects.toThrow('512 KiB');
  });
});
