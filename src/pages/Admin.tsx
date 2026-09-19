import { useEffect, useState } from 'react';
import { PenLine, Plus } from 'lucide-react';
import { PageTitle, Notice } from '../components/ui';
import { requestJSON, type ManagedPost, type ManagedPostSummary } from '../lib/posts';
import PostEditor from '../components/PostEditor';
import './writing.css';
import { useAdminSession } from '../components/AdminArea';
export default function Admin() {
  const { token, setDirty: sessionDirty, setBusy: sessionBusy } = useAdminSession();
  const [posts, setPosts] = useState<ManagedPostSummary[]>([]),
    [selected, setSelected] = useState<ManagedPost | null>(null);
  const [next, setNext] = useState<number | null>(null),
    [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const shownPosts = posts.filter(
    (p) =>
      p.title.toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'all' || (filter === 'published' ? Boolean(p.published_at) : !p.published_at)),
  );
  async function list(key: string, offset = 0) {
    const data = await requestJSON<{ posts: ManagedPostSummary[]; next: number | null }>(
      `/api/admin/posts?offset=${offset}`,
      {},
      key,
    );
    setPosts((items) => (offset ? [...items, ...data.posts] : data.posts));
    setNext(data.next);
  }
  useEffect(() => {
    void list(token)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);
  useEffect(() => {
    sessionDirty(dirty);
    return () => sessionDirty(false);
  }, [dirty, sessionDirty]);
  useEffect(() => {
    sessionBusy(busy);
    return () => sessionBusy(false);
  }, [busy, sessionBusy]);
  function canLeave() {
    return !dirty || window.confirm('当前修改尚未保存到云端。确认切换？浏览器恢复副本会保留。');
  }
  async function select(post?: ManagedPostSummary) {
    if (!canLeave()) return;
    setError('');
    setBusy(true);
    try {
      setSelected(
        post ? await requestJSON<ManagedPost>(`/api/admin/posts/${post.id}`, {}, token) : null,
      );
      setEditing(true);
      setDirty(false);
      setEditorKey((key) => key + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="文章管理"
        description="管理草稿与公开文章。保存草稿不会替换已发布的版本。"
      />
      <div className="editor-toolbar">
        <button className="button primary" disabled={busy} onClick={() => void select()}>
          <Plus size={16} />
          新建文章
        </button>
      </div>
      <div className="writing-layout">
        <aside className="writing-list" aria-label="我的文章">
          <h2>我的文章</h2>
          <p className="muted small-text">草稿仅自己可见，发布后进入文章列表。</p>
          <label className="sr-only" htmlFor="admin-search">
            筛选已加载文章
          </label>
          <input
            id="admin-search"
            className="admin-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="筛选已加载文章…"
          />
          <div className="admin-filter">
            {[
              ['all', '全部'],
              ['draft', '草稿'],
              ['published', '已发布'],
            ].map(([key, label]) => (
              <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>
          {shownPosts.map((p) => (
            <button
              className="writing-item"
              aria-pressed={selected?.id === p.id}
              key={p.id}
              disabled={busy}
              onClick={() => void select(p)}
            >
              <strong>{p.title}</strong>
              <span>
                {p.published_at ? '已发布' : '草稿'} · {p.updated_at.slice(0, 10)}
              </span>
            </button>
          ))}
          {loading && <p role="status">正在打开文章列表…</p>}
          {!loading && !error && !posts.length && (
            <p className="muted">还没有文章。点击“新建文章”，写下第一段文字。</p>
          )}
          {!loading && posts.length > 0 && !shownPosts.length && (
            <p className="muted small-text">已加载的文章中没有匹配项。</p>
          )}
          {next !== null && (
            <button
              className="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await list(token, next);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              加载更多
            </button>
          )}
        </aside>
        {editing ? (
          <PostEditor
            key={editorKey}
            initial={selected}
            token={token}
            onDirty={setDirty}
            onBusy={setBusy}
            onSaved={(row) => {
              setSelected(row);
              setPosts((items) => [
                {
                  id: row.id,
                  title: row.title,
                  published_at: row.published_at,
                  updated_at: row.updated_at,
                },
                ...items.filter((p) => p.id !== row.id),
              ]);
              // A new article shifts the offset of the remaining server results.
              if (!selected && next !== null) setNext(next + 1);
            }}
          />
        ) : (
          <section className="writing-start">
            <PenLine size={36} />
            <h2>选择文章，或新建草稿</h2>
            <p>
              无需编辑代码。新建文章后填写标题和正文，
              <br />
              保存草稿，准备好了再发布。
            </p>
            <button className="button primary" disabled={busy} onClick={() => void select()}>
              写一篇新文章
            </button>
          </section>
        )}
      </div>
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
