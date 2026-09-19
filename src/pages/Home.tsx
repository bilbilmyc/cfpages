import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
import { tools } from '../config/navigation';
import { usePublishedPosts } from '../lib/usePublishedPosts';
import ArticleRows from '../components/ArticleRows';
import QuickJSON from '../components/QuickJSON';
import './home.css';
export default function Home() {
  const { posts, loading, error, retry } = usePublishedPosts();
  return (
    <div className="dashboard">
      <header className="dashboard-title">
        <div>
          <h1>工作台</h1>
          <p>处理文本、整理流程、画下想法。</p>
        </div>
        <span className="workspace-label">无需登录 · 打开即用</span>
      </header>
      <section className="tool-directory" aria-label="常用工具">
        {tools.map(({ to, label, icon: Icon, description, detail }) => (
          <Link className="tool-entry" key={to} to={to}>
            <span className="tool-entry-icon">
              <Icon size={23} />
            </span>
            <div>
              <span className="tool-entry-type">{detail}</span>
              <h2>{label}</h2>
              <p>{description}</p>
            </div>
            <ArrowUpRight className="tool-entry-arrow" size={18} />
          </Link>
        ))}
      </section>
      <div className="dashboard-columns">
        <QuickJSON />
        <section className="tool-shortcuts" aria-labelledby="shortcuts-title">
          <div className="panel-heading">
            <div>
              <h2 id="shortcuts-title">文本工具</h2>
              <p>按任务直接打开。</p>
            </div>
          </div>
          {[
            ['base64', 'Base64', '中文与 UTF-8 编解码'],
            ['url', 'URL 编码', '编码或解码参数'],
            ['timestamp', '时间戳', '日期、秒与毫秒转换'],
            ['hash', 'SHA-256', '计算文本摘要'],
          ].map(([id, label, description]) => (
            <Link to={'/tools/dev?tool=' + id} key={id}>
              <div>
                <strong>{label}</strong>
                <span>{description}</span>
              </div>
              <ArrowRight size={16} />
            </Link>
          ))}
        </section>
      </div>
      <section className="dashboard-notes" aria-labelledby="notes-title">
        <div className="panel-heading">
          <div>
            <h2 id="notes-title">最近文章</h2>
            <p>实践记录与技术笔记。</p>
          </div>
          <Link className="text-link" to="/journal">
            全部文章 <ArrowRight size={14} />
          </Link>
        </div>
        {loading ? (
          <div className="list-skeleton" role="status" aria-label="正在加载文章">
            <span />
            <span />
          </div>
        ) : error ? (
          <div className="compact-empty" role="alert">
            <p>文章暂时无法加载。</p>
            <button className="button small" onClick={retry}>
              重试
            </button>
          </div>
        ) : posts.length ? (
          <ArticleRows posts={posts.slice(0, 4)} compact />
        ) : (
          <div className="compact-empty">
            <p>暂无公开文章。</p>
            <span>上方工具可以直接使用。</span>
          </div>
        )}
      </section>
    </div>
  );
}
