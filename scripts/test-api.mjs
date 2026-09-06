import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:8788';
const headers = { Authorization: 'Bearer test-only-secret-with-at-least-32-characters' };
// This script is deliberately restricted to the local emulator. It never uploads to production.
let response = await fetch(`${base}/api/images`);
assert.equal(response.status, 401);
response = await fetch(`${base}/api/images`, {
  method: 'POST',
  headers,
  body: '<svg>unsafe</svg>',
});
assert.equal(response.status, 415);
response = await fetch(`${base}/api/images`, {
  method: 'POST',
  headers: { ...headers, Origin: 'https://untrusted.test' },
  body: 'test',
});
assert.equal(response.status, 403);
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=',
  'base64',
);
response = await fetch(`${base}/api/images`, {
  method: 'POST',
  headers: {
    ...headers,
    'Content-Type': 'image/png',
    'X-Filename': encodeURIComponent('本地测试.png'),
  },
  body: png,
});
assert.equal(response.status, 201, await response.clone().text());
const image = await response.json();
response = await fetch(image.url);
assert.equal(response.status, 200);
assert.equal(response.headers.get('content-type'), 'image/png');
assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
const etag = response.headers.get('etag');
assert.equal((await fetch(image.url, { headers: { 'If-None-Match': etag } })).status, 304);
assert.equal((await fetch(image.url, { method: 'HEAD' })).status, 200);
assert.equal((await fetch(image.url, { method: 'POST' })).status, 405);
response = await fetch(`${base}/api/images`, { headers });
assert.ok((await response.json()).images.some((item) => item.id === image.id));
assert.equal(
  (await fetch(`${base}/api/images/${image.id}`, { method: 'DELETE', headers })).status,
  200,
);
response = await fetch(`${base}/api/images`, { headers });
assert.ok(!(await response.json()).images.some((item) => item.id === image.id));
assert.equal(
  (await fetch(`${base}/api/images/${image.id}`, { method: 'POST', headers })).status,
  200,
);
response = await fetch(`${base}/api/images`, { headers });
assert.ok((await response.json()).images.some((item) => item.id === image.id));
assert.equal((await fetch(`${base}/api/images?before=bad`, { headers })).status, 400);
// Leave the disposable local fixture archived.
await fetch(`${base}/api/images/${image.id}`, { method: 'DELETE', headers });
console.log(
  'API integration: auth, origin, type validation, R2 upload/read/HEAD/ETag, D1 list/archive/restore and cursor checks passed.',
);
