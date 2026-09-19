import { Hono } from 'hono';
import { HttpError, json, limitedBody, type Env } from '../http';
import { pagination } from '../posts';
import { validContent, type ToolDocument, type ToolKind } from '../../src/lib/toolDocumentData';

const routes = new Hono<{ Bindings: Env }>();
const summary = 'id,kind,title,revision,created_at,updated_at,last_opened_at,archived_at';
const columns = `${summary},content`;
const maxBytes = 2 * 1024 * 1024;
function dbFor(env: Env) {
  if (!env.DB) throw new HttpError(503, '文件库尚未连接数据库。');
  return env.DB;
}
function idFor(value: string) {
  if (
    !/^(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|legacy-(?:flow|canvas))$/.test(
      value,
    )
  )
    throw new HttpError(400, '文件编号无效。');
  return value;
}
function revisionFor(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new HttpError(400, '文件版本无效。');
  return value;
}
function titleFor(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > 80 ||
    /[\x00-\x1f\x7f]/.test(value)
  )
    throw new HttpError(400, '文件名须为 1–80 个字符，不能包含控制字符。');
  return value.trim();
}
function kindFor(value: unknown): ToolKind {
  if (value !== 'flow' && value !== 'canvas') throw new HttpError(400, '文件类型无效。');
  return value;
}
function contentFor(kind: ToolKind, value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, '文件内容无效。');
  if (new TextEncoder().encode(value).byteLength > maxBytes)
    throw new HttpError(413, '文件超过 2 MiB 限制。');
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new HttpError(400, '文件内容不是有效 JSON。');
  }
  if (!validContent(kind, parsed))
    throw new HttpError(400, '文件内容与工具类型不符，或超出工具限制。');
  return value;
}
async function inputFor(request: Request) {
  if (!request.headers.get('Content-Type')?.includes('application/json'))
    throw new HttpError(415, '请使用 JSON 提交文件。');
  const body = await limitedBody(request, maxBytes * 6 + 1024, '文件请求过大。');
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(body));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error();
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(400, '请求不是有效的 JSON 对象。');
  }
}
async function read(db: D1Database, id: string) {
  const row = await db
    .prepare(`SELECT ${columns} FROM tool_documents WHERE id=?`)
    .bind(id)
    .first<ToolDocument>();
  if (!row) throw new HttpError(404, '文件不存在。');
  return row;
}
async function changed(db: D1Database, id: string, row: ToolDocument | null) {
  if (!row) {
    await read(db, id);
    throw new HttpError(409, '文件已在其他窗口修改或归档。已暂停保存，请重新打开或另存副本。');
  }
  return json(row);
}
async function create(db: D1Database, kind: ToolKind, title: string, content: string) {
  const now = new Date().toISOString();
  return (await db
    .prepare(
      `INSERT INTO tool_documents(id,kind,title,content,created_at,updated_at,last_opened_at)
    VALUES(?,?,?,?,?,?,?) RETURNING ${columns}`,
    )
    .bind(crypto.randomUUID(), kind, title, content, now, now, now)
    .first<ToolDocument>())!;
}
routes.get('/', async (c) => {
  const url = new URL(c.req.url),
    offset = pagination(url);
  const archived = url.searchParams.get('archived') || '0';
  const kind = url.searchParams.get('kind') || '';
  const query = url.searchParams.get('q')?.trim() || '';
  if (
    !['0', '1'].includes(archived) ||
    (kind && kind !== 'flow' && kind !== 'canvas') ||
    query.length > 80
  )
    throw new HttpError(400, '文件筛选条件无效。');
  const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
  const { results } = await dbFor(c.env)
    .prepare(
      `SELECT ${summary} FROM tool_documents
    WHERE archived_at IS ${archived === '1' ? 'NOT ' : ''}NULL AND (?='' OR kind=?) AND title LIKE ? ESCAPE '\\'
    ORDER BY last_opened_at DESC,id DESC LIMIT 21 OFFSET ?`,
    )
    .bind(kind, kind, pattern, offset)
    .all();
  return json({ documents: results.slice(0, 20), next: results.length > 20 ? offset + 20 : null });
});
routes.post('/', async (c) => {
  const input = await inputFor(c.req.raw),
    kind = kindFor(input.kind);
  return json(
    await create(dbFor(c.env), kind, titleFor(input.title), contentFor(kind, input.content)),
    201,
  );
});
// Copy existing singleton drafts at first connection, never replace an edited document.
// The legacy table/API remains intact so application rollback does not lose data.
routes.post('/import-legacy', async (c) => {
  const db = dbFor(c.env);
  const { results } = await db
    .prepare("SELECT id,content,updated_at FROM tool_drafts WHERE id IN ('flow','canvas')")
    .all<{ id: ToolKind; content: string; updated_at: string }>();
  const skipped: string[] = [],
    statements: D1PreparedStatement[] = [];
  for (const old of results) {
    try {
      contentFor(old.id, old.content);
    } catch {
      skipped.push(old.id);
      continue;
    }
    statements.push(
      db
        .prepare(
          `INSERT INTO tool_documents(id,kind,title,content,created_at,updated_at,last_opened_at)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
        )
        .bind(
          `legacy-${old.id}`,
          old.id,
          old.id === 'flow' ? '原有流程图草稿' : '原有画布草稿',
          old.content,
          old.updated_at,
          old.updated_at,
          old.updated_at,
        ),
    );
  }
  const imported = statements.length
    ? (await db.batch(statements)).reduce((sum, r) => sum + r.meta.changes, 0)
    : 0;
  return json({ imported, skipped });
});
routes.get('/:id', async (c) => json(await read(dbFor(c.env), idFor(c.req.param('id')))));
routes.post('/:id/open', async (c) => {
  const db = dbFor(c.env),
    id = idFor(c.req.param('id'));
  const row = await db
    .prepare(
      `UPDATE tool_documents SET last_opened_at=CASE WHEN archived_at IS NULL THEN ? ELSE last_opened_at END WHERE id=? RETURNING ${columns}`,
    )
    .bind(new Date().toISOString(), id)
    .first<ToolDocument>();
  return changed(db, id, row);
});
routes.put('/:id', async (c) => {
  const db = dbFor(c.env),
    id = idFor(c.req.param('id')),
    input = await inputFor(c.req.raw);
  const revision = revisionFor(input.revision),
    existing = await read(db, id);
  const content = contentFor(existing.kind, input.content);
  const row = await db
    .prepare(
      `UPDATE tool_documents SET content=?,revision=revision+1,updated_at=?
    WHERE id=? AND revision=? AND archived_at IS NULL RETURNING ${columns}`,
    )
    .bind(content, new Date().toISOString(), id, revision)
    .first<ToolDocument>();
  return changed(db, id, row);
});
routes.patch('/:id', async (c) => {
  const db = dbFor(c.env),
    id = idFor(c.req.param('id')),
    input = await inputFor(c.req.raw);
  const revision = revisionFor(input.revision),
    now = new Date().toISOString();
  let row: ToolDocument | null;
  if (input.action === 'rename') {
    row = await db
      .prepare(
        `UPDATE tool_documents SET title=?,revision=revision+1,updated_at=?
      WHERE id=? AND revision=? AND archived_at IS NULL RETURNING ${columns}`,
      )
      .bind(titleFor(input.title), now, id, revision)
      .first<ToolDocument>();
  } else if (input.action === 'archive' || input.action === 'restore') {
    row = await db
      .prepare(
        `UPDATE tool_documents SET archived_at=?,revision=revision+1,updated_at=?
      WHERE id=? AND revision=? AND archived_at IS ${input.action === 'restore' ? 'NOT ' : ''}NULL RETURNING ${columns}`,
      )
      .bind(input.action === 'archive' ? now : null, now, id, revision)
      .first<ToolDocument>();
  } else throw new HttpError(400, '文件操作无效。');
  return changed(db, id, row);
});
routes.post('/:id/duplicate', async (c) => {
  const db = dbFor(c.env),
    source = await read(db, idFor(c.req.param('id')));
  const title = source.title.slice(0, 76).replace(/[\uD800-\uDBFF]$/, '') + ' 副本';
  return json(await create(db, source.kind, title, source.content), 201);
});
export default routes;
