import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:8788'; // Intentionally restricted to the isolated local emulator.
const auth = {
  Authorization: 'Bearer test-only-secret-with-at-least-32-characters',
  'Content-Type': 'application/json',
};
const root = '/api/admin/documents';
const call = (path = '', method = 'GET', body, headers = auth) =>
  fetch(base + root + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
async function ok(path, method, body, status = 200) {
  const r = await call(path, method, body);
  assert.equal(r.status, status, await r.clone().text());
  return r.json();
}
const tag = `文件验收-${Date.now()}`;
const empty = JSON.stringify({ nodes: [], edges: [] });
const made = [];
try {
  for (const [path, method] of [
    ['', 'GET'],
    ['', 'POST'],
    ['/import-legacy', 'POST'],
    ['/legacy-flow', 'GET'],
    ['/legacy-flow', 'PUT'],
    ['/legacy-flow', 'PATCH'],
    ['/legacy-flow/open', 'POST'],
    ['/legacy-flow/duplicate', 'POST'],
  ])
    assert.equal((await call(path, method, undefined, {})).status, 401);
  assert.equal(
    (await call('', 'POST', {}, { ...auth, Origin: 'https://untrusted.test' })).status,
    403,
  );
  for (const fields of [
    { kind: 'other', title: 'x', content: empty },
    { kind: 'flow', title: ' ', content: empty },
    { kind: 'canvas', title: 'x', content: empty },
    { kind: 'flow', title: 'x', content: 'null' },
  ])
    assert.equal((await call('', 'POST', fields)).status, 400);
  for (const q of ['?offset=-1', '?archived=2', '?kind=other'])
    assert.equal((await call(q)).status, 400);
  assert.equal((await call('/not-an-id')).status, 400);
  assert.equal((await call('/00000000-0000-0000-0000-000000000001')).status, 404);
  let doc = await ok('', 'POST', { kind: 'flow', title: tag, content: empty }, 201);
  made.push(doc.id);
  assert.equal(doc.revision, 1);
  doc = await ok(`/${doc.id}`, 'PATCH', {
    action: 'rename',
    title: tag + ' %_',
    revision: doc.revision,
  });
  const copy = await ok(`/${doc.id}/duplicate`, 'POST', undefined, 201);
  made.push(copy.id);
  assert.notEqual(copy.id, doc.id);
  assert.equal(copy.content, doc.content);
  assert.equal(copy.revision, 1);
  const content = JSON.stringify({
    nodes: [{ id: 'one', position: { x: 10, y: 20 }, data: { label: '独立文件' } }],
    edges: [],
  });
  const oldRevision = doc.revision;
  const races = await Promise.all(
    [1, 2].map(() => call(`/${doc.id}`, 'PUT', { content, revision: oldRevision })),
  );
  assert.deepEqual(races.map((r) => r.status).sort(), [200, 409]);
  doc = await ok(`/${doc.id}`, 'GET');
  assert.equal((await ok(`/${copy.id}`, 'GET')).content, empty, 'copy must remain independent');
  assert.equal(
    (await call(`/${doc.id}`, 'PATCH', { action: 'rename', title: 'stale', revision: oldRevision }))
      .status,
    409,
  );
  const revision = doc.revision;
  doc = await ok(`/${doc.id}/open`, 'POST');
  assert.equal(doc.revision, revision, 'opening must not invalidate another editor');
  doc = await ok(`/${doc.id}`, 'PATCH', { action: 'archive', revision: doc.revision });
  assert.ok(doc.archived_at);
  assert.equal(
    (await call(`/${doc.id}`, 'PUT', { content: empty, revision: doc.revision })).status,
    409,
  );
  assert.equal(
    (
      await call(`/${doc.id}`, 'PATCH', {
        action: 'rename',
        title: 'archived',
        revision: doc.revision,
      })
    ).status,
    409,
  );
  assert.ok((await ok(`/${doc.id}/open`, 'POST')).archived_at);
  assert.ok(
    !(await ok(`?q=${encodeURIComponent(tag)}`, 'GET')).documents.some(
      (item) => item.id === doc.id,
    ),
  );
  assert.ok(
    (await ok(`?archived=1&q=${encodeURIComponent(tag)}`, 'GET')).documents.some(
      (item) => item.id === doc.id,
    ),
  );
  doc = await ok(`/${doc.id}`, 'PATCH', { action: 'restore', revision: doc.revision });
  assert.equal(doc.archived_at, null);
  assert.equal(doc.content, content);
  assert.ok(
    (await ok(`?q=${encodeURIComponent('%_')}`, 'GET')).documents.every((item) =>
      item.title.includes('%_'),
    ),
    'search must escape wildcards',
  );
  for (let i = 0; i < 22; i++) {
    const item = await ok(
      '',
      'POST',
      { kind: i % 2 ? 'flow' : 'canvas', title: `${tag} page ${i}`, content: i % 2 ? empty : '[]' },
      201,
    );
    made.push(item.id);
  }
  const first = await ok(`?q=${tag}`, 'GET'),
    second = await ok(`?q=${tag}&offset=${first.next}`, 'GET');
  assert.equal(first.documents.length, 20);
  assert.equal(first.next, 20);
  assert.equal(second.next, null);
  assert.equal(
    new Set([...first.documents, ...second.documents].map((d) => d.id)).size,
    made.length,
  );
  assert.ok((await ok(`?q=${tag}&kind=canvas`, 'GET')).documents.every((d) => d.kind === 'canvas'));
  await ok(`/${doc.id}/open`, 'POST');
  assert.equal((await ok(`?q=${tag}`, 'GET')).documents[0].id, doc.id);

  // Import is a one-time copy. Reconnecting must not overwrite existing files or legacy data.
  const legacyURL = base + '/api/admin/drafts/flow';
  const legacy = await (await fetch(legacyURL, { headers: auth })).json();
  assert.ok(
    (
      await fetch(legacyURL, {
        method: 'PUT',
        headers: auth,
        body: JSON.stringify({ content: empty, revision: legacy.revision }),
      })
    ).ok,
  );
  await ok('/import-legacy', 'POST');
  const imported = await ok('/legacy-flow', 'GET');
  const after = await (await fetch(legacyURL, { headers: auth })).json();
  await fetch(legacyURL, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({ content, revision: after.revision }),
  });
  await ok('/import-legacy', 'POST');
  assert.equal((await ok('/legacy-flow', 'GET')).content, imported.content);
  assert.equal((await (await fetch(legacyURL, { headers: auth })).json()).content, content);
  console.log(
    'Documents integration passed: auth, validation, independent copies, CAS, archive/restore, recency, filtered pagination and idempotent legacy import.',
  );
} finally {
  for (const id of made) {
    const current = await ok(`/${id}`, 'GET');
    if (!current.archived_at)
      await ok(`/${id}`, 'PATCH', { action: 'archive', revision: current.revision });
  }
}
