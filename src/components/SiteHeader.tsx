import { Link, NavLink, useLocation } from 'react-router-dom';
import { Github, ArrowUpRight } from 'lucide-react';
import { site } from '../config';
import { tools } from '../config/navigation';

export default function SiteHeader() {
  const { pathname } = useLocation();
  return (
    <header className="workspace-header">
      <div className="workspace-header-inner">
        <Link className="workspace-brand" to="/" aria-label="返回工作台">
          <span className="workspace-mark">
            s<span>.</span>
          </span>
          <span>
            {site.author}
            <small>个人工作台</small>
          </span>
        </Link>
        <nav className="workspace-nav" aria-label="主要导航">
          <NavLink to="/" end>
            工作台
          </NavLink>
          {tools.map(({ to, label }) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
          <NavLink to="/journal">文章</NavLink>
        </nav>
        <a
          className="workspace-source"
          href={site.github}
          target="_blank"
          rel="noreferrer"
          aria-label="在 GitHub 查看项目"
        >
          <Github size={18} />
          <ArrowUpRight size={13} />
        </a>
      </div>
      {pathname.startsWith('/tools/') && (
        <div className="workspace-context">
          <span>工具箱 / {tools.find((t) => t.to === pathname)?.label}</span>
          <span>浏览器内处理 · 支持导出</span>
        </div>
      )}
    </header>
  );
}
