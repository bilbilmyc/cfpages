import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { BookOpen, Image, ArrowUpRight, LockKeyhole, LogOut } from 'lucide-react';
import { Notice } from './ui';
import PageBoundary from './PageBoundary';
import { requestJSON } from '../lib/posts';
import { site } from '../config';
import './admin-area.css';
const Writing = lazy(() => import('../pages/Admin'));
const Images = lazy(() => import('../pages/Images'));
const Session = createContext<{
  token: string;
  setDirty: (v: boolean) => void;
  setBusy: (v: boolean) => void;
} | null>(null);
export function useAdminSession() {
  const session = useContext(Session);
  if (!session) throw Error('Admin session required');
  return session;
}
export default function AdminArea() {
  const { pathname } = useLocation();
  const [token, setToken] = useState(''),
    [credential, setCredential] = useState('');
  const [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState('');
  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await requestJSON('/api/admin/session', {}, credential);
      setToken(credential);
      setCredential('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function canLeave() {
    return (
      !busy && (!dirty || window.confirm('文字尚未保存到云端，确认离开？浏览器恢复副本会保留。'))
    );
  }
  function guard(e: MouseEvent<HTMLAnchorElement>) {
    if (!canLeave()) e.preventDefault();
  }
  return (
    <div className="admin-area">
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      <header className="admin-header">
        <div className="admin-brand">
          <span className="brand-mark">s.</span>
          <div>
            {site.author}
            <small>站主管理后台</small>
          </div>
        </div>
        <Link className="text-link" to="/" onClick={guard}>
          返回网站 <ArrowUpRight size={16} />
        </Link>
      </header>
      {token && (
        <nav className="admin-nav" aria-label="后台导航">
          <NavLink to="/admin" end onClick={guard}>
            <BookOpen size={17} />
            文章管理
          </NavLink>
          <NavLink to="/admin/images" onClick={guard}>
            <Image size={17} />
            图片管理
          </NavLink>
          <button
            className="button small"
            disabled={busy}
            onClick={() => {
              if (canLeave()) {
                setToken('');
                setDirty(false);
                setError('');
              }
            }}
          >
            <LogOut size={15} />
            退出登录
          </button>
        </nav>
      )}
      <main id="main" className="admin-main" tabIndex={-1}>
        {!token ? (
          <div className="login-panel">
            <span className="login-icon">
              <LockKeyhole size={32} />
            </span>
            <h1>站主登录</h1>
            <p>
              这里用于写文章、发布内容和管理图片。
              <br />
              阅读文章和使用工具无需登录。
            </p>
            <form onSubmit={login}>
              <label htmlFor="owner-token">管理员密钥</label>
              <input
                id="owner-token"
                type="password"
                autoComplete="off"
                required
                maxLength={512}
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder="输入你保存的 Token"
              />
              <button className="button primary" disabled={busy}>
                {busy ? '正在验证…' : '登录管理后台'}
              </button>
            </form>
            <small>登录仅在当前页面会话内有效，刷新或退出后清除。</small>
            {error && <Notice error>{error}</Notice>}
          </div>
        ) : (
          <Session.Provider value={{ token, setDirty, setBusy }}>
            <PageBoundary key={pathname}>
              <Suspense fallback={<p role="status">正在打开管理页面…</p>}>
                <Routes>
                  <Route path="/admin" element={<Writing />} />
                  <Route path="/admin/images" element={<Images />} />
                  <Route
                    path="*"
                    element={
                      <div className="empty">
                        <h1>管理页面不存在</h1>
                        <Link to="/admin">返回文章管理</Link>
                      </div>
                    }
                  />
                </Routes>
              </Suspense>
            </PageBoundary>
          </Session.Provider>
        )}
      </main>
      <footer className="admin-footer">
        {site.domain} · 内容由站主管理，发布后对所有访客可见。
      </footer>
    </div>
  );
}
