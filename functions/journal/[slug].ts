import { type Env } from '../../server/http';
import type { PublicPost } from '../../src/lib/posts';
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export const onRequestGet: PagesFunction<Env & { ASSETS: Fetcher }> = async ({
  env,
  params,
  request,
}) => {
  try {
    const row =
      typeof params.slug === 'string' &&
      params.slug.length <= 100 &&
      (await env.DB?.prepare(
        'SELECT published_content FROM posts WHERE slug=? AND published_at IS NOT NULL',
      )
        .bind(params.slug)
        .first<{ published_content: string }>());
    const post = row ? (JSON.parse(row.published_content) as PublicPost & { html?: string }) : null;
    const asset = await env.ASSETS.fetch(new URL('/index.html', request.url));
    const response = new Response(asset.body, { status: post ? 200 : 404, headers: asset.headers });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.delete('ETag');
    response.headers.delete('Content-Length');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    );
    const title = post?.title || '文章不存在或尚未发布';
    const canonical = `https://199819.xyz/journal/${encodeURIComponent(String(params.slug))}`;
    return new HTMLRewriter()
      .on('title', {
        element(e) {
          e.setInnerContent(`${title} · Soren 的个人空间`);
        },
      })
      .on('meta[name="description"], meta[property="og:description"]', {
        element(e) {
          e.setAttribute('content', post?.summary || title);
        },
      })
      .on('meta[property="og:title"]', {
        element(e) {
          e.setAttribute('content', title);
        },
      })
      .on('meta[property="og:url"]', {
        element(e) {
          e.setAttribute('content', canonical);
        },
      })
      .on('meta[property="og:type"]', {
        element(e) {
          e.setAttribute('content', 'article');
        },
      })
      .on('link[rel="canonical"]', {
        element(e) {
          e.setAttribute('href', canonical);
        },
      })
      .on('main', {
        element(e) {
          e.setInnerContent(
            post
              ? `<article class="reader"><a class="text-link" href="/journal">← 返回文章</a><p class="article-meta">${escape(post.category)} · ${escape(post.date)}</p><h1>${escape(post.title)}</h1><p class="reader-summary">${escape(post.summary)}</p><div class="prose">${post.html || escape(post.body)}</div></article>`
              : `<section class="empty"><h1>${title}</h1><a href="/journal">返回文章列表</a></section>`,
            { html: true },
          );
        },
      })
      .transform(response);
  } catch {
    return new Response('文章服务暂时不可用，请稍后重试。', {
      status: 503,
      headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
};
