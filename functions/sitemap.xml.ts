import type { Env } from '../server/http';
export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.DB) return new Response('Database unavailable', { status: 503 });
  const url = new URL(request.url),
    page = url.searchParams.get('page');
  const headers = { 'Content-Type': 'application/xml;charset=utf-8', 'Cache-Control': 'no-store' };
  if (page === null) {
    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM posts WHERE published_at IS NOT NULL',
    ).first<{ count: number }>();
    const total = Math.max(1, Math.ceil((row?.count || 0) / 1000));
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({ length: total }, (_, i) => `<sitemap><loc>https://199819.xyz/sitemap.xml?page=${i}</loc></sitemap>`).join('')}</sitemapindex>`,
      { headers },
    );
  }
  if (!/^\d{1,5}$/.test(page)) return new Response('Invalid page', { status: 400 });
  const { results } = await env.DB.prepare(
    'SELECT slug FROM posts WHERE published_at IS NOT NULL ORDER BY published_at DESC,id DESC LIMIT 1000 OFFSET ?',
  )
    .bind(Number(page) * 1000)
    .all<{ slug: string }>();
  const paths = [
    ...(page === '0' ? ['/', '/journal', '/about'] : []),
    ...results.map((p) => `/journal/${encodeURIComponent(p.slug)}`),
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>https://199819.xyz${p}</loc></url>`).join('')}</urlset>`,
    { headers },
  );
};
