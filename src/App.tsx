import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation, Link, Navigate } from 'react-router-dom';
import { site } from './config';
import { tools } from './config/navigation';
import Home from './pages/Home';
import About from './pages/About';
import SiteHeader from './components/SiteHeader';
import PageBoundary from './components/PageBoundary';
import Journal from './pages/Journal';
import { WorkspaceSession } from './components/documents/WorkspaceSession';
const DocumentPage = lazy(() => import('./pages/Document'));
const Flow = lazy(() => import('./pages/Flow'));
const Canvas = lazy(() => import('./pages/Canvas'));
const DevTools = lazy(() => import('./pages/DevTools'));
const AdminArea = lazy(() => import('./components/AdminArea'));
export default function App() {
  return (
    <WorkspaceSession>
      <Application />
    </WorkspaceSession>
  );
}
function Application() {
  const location = useLocation();
  const pathname = location.pathname.replace(/\/$/, '') || '/';
  useEffect(() => {
    const title =
      tools.find((t) => t.to === pathname || pathname.startsWith(t.to + '/'))?.label ||
      (pathname === '/'
        ? '工作台'
        : pathname.startsWith('/admin')
          ? '站主管理'
          : pathname.startsWith('/journal')
            ? '文章'
            : '关于');
    document.title = title + ' · ' + site.name;
    document
      .querySelector('link[rel="canonical"]')
      ?.setAttribute('href', 'https://' + site.domain + pathname);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
    window.scrollTo(0, 0);
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);
  if (pathname === '/images') return <Navigate to="/admin/images" replace />;
  if (pathname === '/admin' || pathname.startsWith('/admin/'))
    return (
      <PageBoundary>
        <Suspense
          fallback={
            <p className="loading" role="status">
              正在打开管理后台…
            </p>
          }
        >
          <AdminArea />
        </Suspense>
      </PageBoundary>
    );
  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      <SiteHeader />
      <main
        id="main"
        className={
          pathname.startsWith('/tools/') ? 'workspace-main tool-workspace' : 'workspace-main'
        }
        tabIndex={-1}
      >
        <PageBoundary key={pathname}>
          <Suspense
            fallback={
              <div className="loading" role="status">
                正在打开页面…
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/journal/:slug" element={<Journal />} />
              <Route path="/tools/flow" element={<Flow />} />
              <Route path="/tools/flow/:id" element={<DocumentPage kind="flow" />} />
              <Route path="/tools/canvas" element={<Canvas />} />
              <Route path="/tools/canvas/:id" element={<DocumentPage kind="canvas" />} />
              <Route path="/tools/dev" element={<DevTools />} />
              <Route path="/about" element={<About />} />
              <Route
                path="*"
                element={
                  <section className="empty">
                    <h1>页面不存在</h1>
                    <p>请检查地址，或返回工作台选择工具。</p>
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
      <footer className="workspace-footer">
        <Link to="/">{site.author} 的工作台</Link>
        <div>
          <span>{site.domain}</span>
          <Link to="/about">关于与隐私</Link>
        </div>
      </footer>
    </div>
  );
}
