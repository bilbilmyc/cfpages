import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:8788';
const headers = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer test-only-secret-with-at-least-32-characters',
};
const fields = {
  title: '集成测试文章',
  summary: '公开摘要',
  category: '验证',
  body: 'FIRST PUBLIC BODY',
};
const api = (path, init = {}) => fetch(`${base}${path}`, init);
assert.equal((await api('/api/admin/posts')).status, 401);
assert.equal((await api('/api/admin/session')).status,401);
assert.equal((await api('/api/admin/session',{headers})).status,200);
assert.equal(
  (
    await api('/api/admin/posts', {
      method: 'POST',
      headers: { ...headers, Origin: 'https://untrusted.test' },
      body: JSON.stringify(fields),
    })
  ).status,
  403,
);
let r = await api('/api/admin/posts', { method: 'POST', headers, body: JSON.stringify(fields) });
assert.equal(r.status, 201, await r.clone().text());
let post = await r.json();
const path = `/api/admin/posts/${post.id}`,
  publicPath = `/api/posts/${post.slug}`;
async function update(action, changes = {}) {
  const response = await api(path, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ ...post, ...changes, action }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  post = await response.json();
}
try {
  assert.equal((await api(publicPath)).status, 404, 'draft must not be public');
  assert.equal((await api(`/journal/${post.slug}`)).status, 404);
  const listing = await (await api('/api/posts')).json();
  assert.ok(!listing.posts.some((p) => p.id === post.id));
  await update('publish');
  assert.equal((await (await api(publicPath)).json()).body, fields.body);
  const articlePage = await api(`/journal/${post.slug}`);
  assert.equal(articlePage.status, 200);
  assert.ok(
    (await articlePage.text()).includes('<p>FIRST PUBLIC BODY</p>'),
    'reader must have rendered HTML before JavaScript',
  );
  assert.ok((await (await api('/sitemap.xml?page=0')).text()).includes(post.slug));
  const oldRevision = post.revision;
  await update('save', { title: 'PRIVATE NEW TITLE', body: 'PRIVATE DRAFT BODY' });
  const publicPost = await (await api(publicPath)).json();
  assert.equal(publicPost.title, fields.title, 'saving a draft must preserve published text');
  assert.equal(publicPost.body, fields.body);
  const publishedList = await (await api('/api/posts?q=PRIVATE')).json();
  assert.ok(!publishedList.posts.some((p) => p.id === post.id), 'search must not reveal drafts');
  r = await api(path, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ ...post, revision: oldRevision, action: 'publish' }),
  });
  assert.equal(r.status, 409, 'stale editors cannot overwrite');
  await update('publish');
  assert.equal((await (await api(publicPath)).json()).body, 'PRIVATE DRAFT BODY');
  await update('unpublish');
  assert.equal((await api(publicPath)).status, 404);
  assert.equal((await api(`/journal/${post.slug}`)).status, 404);
  assert.ok(!(await (await api('/sitemap.xml?page=0')).text()).includes(post.slug));
  r = await api(path, { headers });
  assert.equal((await r.json()).body, 'PRIVATE DRAFT BODY', 'unpublishing preserves draft');
  assert.equal((await api('/api/posts?offset=-1')).status, 400);
  console.log(
    'Posts integration passed: authentication, origin checks, draft privacy, published snapshot, search privacy, conflict detection and unpublish.',
  );
} finally {
  if (post.published_at) await update('unpublish');
}
