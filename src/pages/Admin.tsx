import { useState, type FormEvent } from 'react';
import { PenLine, Plus, LogOut } from 'lucide-react';
import { PageTitle, Notice } from '../components/ui';
import { requestJSON, type ManagedPost, type ManagedPostSummary } from '../lib/posts';
import PostEditor from '../components/PostEditor';
import './writing.css';
export default function Admin() {
  const [token, setToken] = useState(''),
    [credential, setCredential] = useState('');
  const [posts, setPosts] = useState<ManagedPostSummary[]>([]),
    [selected, setSelected] = useState<ManagedPost | null>(null);
  const [next, setNext] = useState<number | null>(null),
    [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  async function list(key: string, offset = 0) {
    const data = await requestJSON<{ posts: ManagedPostSummary[]; next: number | null }>(
      `/api/admin/posts?offset=${offset}`,
      {},
      key,
    );
    setPosts((items) => (offset ? [...items, ...data.posts] : data.posts));
    setNext(data.next);
  }
  async function login(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await list(credential);
      setToken(credential);
      setCredential('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
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
        title="写作后台"
        description="留一个念头，写一篇文章。按自己的节奏，把想法慢慢写完整。"
      />
      {!token ? (
        <div className="login-panel">
          <span className="login-icon">
            <PenLine size={35} />
          </span>
          <h2>从这里开始写</h2>
          <p>使用你在 Cloudflare 保存的 ADMIN_TOKEN 登录，和图片空间使用同一个密钥。</p>
          <form onSubmit={login}>
            <label htmlFor="writer-token">管理员密钥</label>
            <input
              id="writer-token"
              type="password"
              autoComplete="off"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              required
              maxLength={512}
              placeholder="粘贴你保存的 Token"
            />
            <button className="button primary" disabled={busy}>
              {busy ? '正在登录…' : '进入写作后台'}
            </button>
          </form>
          <small>登录密钥仅保存在页面内存中，刷新后需重新登录。</small>
        </div>
      ) : (
        <>
          <div className="editor-toolbar">
            <button className="button primary" disabled={busy} onClick={() => void select()}>
              <Plus size={16} />
              新建文章
            </button>
            <span className="toolbar-spacer" />
            <button
              className="button"
              disabled={busy}
              onClick={() => {
                if (canLeave()) {
                  setToken('');
                  setSelected(null);
                  setPosts([]);
                  setEditing(false);
                  setDirty(false);
                }
              }}
            >
              <LogOut size={16} />
              退出后台
            </button>
          </div>
          <div className="writing-layout">
            <aside className="writing-list" aria-label="我的文章">
              <h2>我的文章</h2>
              <p className="muted small-text">草稿仅自己可见，发布后进入文章列表。</p>
              {posts.map((p) => (
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
              {!posts.length && (
                <p className="muted">还没有文章。点击“新建文章”，写下第一段文字。</p>
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
                  void list(token).catch((e) => setError(e.message));
                }}
              />
            ) : (
              <section className="writing-start">
                <PenLine size={36} />
                <h2>把第一句话写下来</h2>
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
        </>
      )}
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
