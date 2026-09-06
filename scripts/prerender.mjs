import { createServer } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
const escape = (text) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
try {
  const { pages, render } = await server.ssrLoadModule('/src/entry-server.tsx');
  const template = await readFile('dist/index.html', 'utf8');
  for (const page of pages) {
    const canonical = `https://199819.xyz${page.path === '/' ? '/' : page.path}`;
    const html = template
      .replace('<div id="root"></div>', () => `<div id="root">${render(page.path)}</div>`)
      .replace(/<title>.*?<\/title>/s, () => `<title>${escape(page.title)}</title>`)
      .replace(
        /<meta name="description"[^>]*>/,
        () => `<meta name="description" content="${escape(page.description)}" />`,
      )
      .replace(
        '</head>',
        () =>
          `<link rel="canonical" href="${canonical}" /><meta property="og:title" content="${escape(page.title)}" /><meta property="og:description" content="${escape(page.description)}" /><meta property="og:url" content="${canonical}" /><meta property="og:type" content="${page.path.startsWith('/journal/') ? 'article' : 'website'}" /></head>`,
      );
    const directory = join('dist', page.path.slice(1));
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'index.html'), html);
  }
  await writeFile(
    'dist/sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((page) => `<url><loc>https://199819.xyz${page.path}</loc></url>`).join('')}</urlset>`,
  );
  await writeFile(
    'dist/robots.txt',
    'User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://199819.xyz/sitemap.xml\n',
  );
  console.log(`Prerendered ${pages.length} content pages and sitemap.`);
} finally {
  await server.close();
}
