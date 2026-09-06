import { lazy, Suspense, useEffect } from 'react';
import { NavLink, Route, Routes, useLocation, Link } from 'react-router-dom';
import {
  House,
  BookOpen,
  Workflow,
  PencilRuler,
  Braces,
  Image,
  ArrowUpRight,
  Github,
  Leaf,
} from 'lucide-react';
import { site } from './config';
import { articles } from './content/articles';
import Home from './pages/Home';
import Journal from './pages/Journal';
import About from './pages/About';
import PageBoundary from './components/PageBoundary';
const Flow = lazy(() => import('./pages/Flow'));
const Canvas = lazy(() => import('./pages/Canvas'));
const DevTools = lazy(() => import('./pages/DevTools'));
const Images = lazy(() => import('./pages/Images'));
const links = [
  { to: '/', label: '工作台', icon: House },
  { to: '/journal', label: '文章与分享', icon: BookOpen },
  { to: '/tools/flow', label: '流程图', icon: Workflow },
  { to: '/tools/canvas', label: '自由画布', icon: PencilRuler },
  { to: '/tools/dev', label: '开发工具', icon: Braces },
  { to: '/images', label: '图片空间', icon: Image },
];
export default function App() {
  const location = useLocation();
  const pathname = location.pathname.replace(/\/$/, '') || '/';
  useEffect(() => {
    const article = articles.find((a) => `/journal/${a.slug}` === pathname);
    const title =
      article?.title ||
      links.find((item) => item.to === pathname)?.label ||
      (pathname.startsWith('/journal/') ? '阅读文章' : '关于');
    document.title = `${title} · ${site.name}`;
    document
      .querySelector('link[rel="canonical"]')
      ?.setAttribute('href', `https://${site.domain}${pathname}`);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
    if (article)
      document.querySelector('meta[name="description"]')?.setAttribute('content', article.summary);
    window.scrollTo(0, 0);
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      <aside className="sidebar">
        <Link className="brand" to="/" aria-label="返回工作台">
          <span className="brand-mark">s.</span>
          <span>
            {site.author}
            <small>数字花园 / DIGITAL GARDEN</small>
          </span>
        </Link>
        <div className="sidebar-intro">
          记录所见，
          <br />
          也动手做点什么。
        </div>
        <nav aria-label="主要导航">
          {links.map(({ to, label, icon: Icon }, i) => (
            <div key={to}>
              {i === 2 && <p className="nav-label">随手可用的工具</p>}
              <NavLink end={to === '/'} to={to}>
                <Icon size={18} strokeWidth={1.65} />
                <span>{label}</span>
                {i === 0 && <span className="nav-dot" />}
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/about">
            <Leaf size={17} />
            关于这个空间
            <ArrowUpRight size={14} />
          </NavLink>
          <a href={site.github} target="_blank" rel="noreferrer">
            <Github size={17} />
            GitHub
            <ArrowUpRight size={14} />
          </a>
          <span className="domain">{site.domain}</span>
        </div>
      </aside>
      <div className="main-shell">
        <div className="topbar">
          <span>一个持续生长的个人空间</span>
          <span className="topbar-note">
            <span className="green-dot" />
            保持好奇，持续创造
          </span>
        </div>
        <main id="main" tabIndex={-1}>
          <PageBoundary key={pathname}>
            <Suspense
              fallback={
                <div className="loading" role="status">
                  正在打开工具…
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/journal" element={<Journal />} />
                <Route path="/journal/:slug" element={<Journal />} />
                <Route path="/tools/flow" element={<Flow />} />
                <Route path="/tools/canvas" element={<Canvas />} />
                <Route path="/tools/dev" element={<DevTools />} />
                <Route path="/images" element={<Images />} />
                <Route path="/about" element={<About />} />
                <Route
                  path="*"
                  element={
                    <section className="empty">
                      <h1>这条小路还没有铺好</h1>
                      <p>页面不存在，回到工作台继续探索吧。</p>
                      <Link className="button" to="/">
                        返回工作台
                      </Link>
                    </section>
                  }
                />
              </Routes>
            </Suspense>
          </PageBoundary>
        </main>
        <footer>
          <span>
            © {new Date().getFullYear()} {site.author} · 一点思考，一些创造。
          </span>
          <Link to="/about">
            关于与隐私 <ArrowUpRight size={13} />
          </Link>
        </footer>
      </div>
    </div>
  );
}
