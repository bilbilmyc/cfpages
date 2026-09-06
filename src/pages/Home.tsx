import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Workflow,
  PencilRuler,
  Braces,
  Image,
  CornerDownRight,
  ArrowRight,
} from 'lucide-react';
import { usePublishedPosts } from '../lib/usePublishedPosts';
import { site } from '../config';
import { TextLink } from '../components/ui';
export default function Home() {
  const { posts: articles, loading, error } = usePublishedPosts();
  return (
    <div className="home">
      <header className="welcome">
        <p className="hello">
          你好，欢迎来坐坐 <span aria-hidden="true">✳</span>
        </p>
        <h1>
          分享一点思考，
          <br />
          创造一些<span>有用的东西。</span>
        </h1>
        <p className="intro">
          我是 {site.author}。这里放着技术笔记、日常灵感，
          <br className="desktop-break" />
          还有随手就能打开的小工具。慢慢探索，尽管使用。
        </p>
        <div className="welcome-links">
          <TextLink to="/journal">翻翻我的笔记</TextLink>
          <TextLink to="/about">认识这个空间</TextLink>
        </div>
      </header>
      <section className="workbench-section" aria-labelledby="workbench-title">
        <div className="section-head">
          <h2 id="workbench-title">从一个想法开始</h2>
          <span className="muted">浏览器打开，就能动手</span>
        </div>
        <div className="workbench-grid">
          <Link className="feature-tool" to="/tools/flow">
            <div className="feature-tool-head">
              <Workflow size={22} />
              <span>流程图</span>
              <ArrowUpRight size={22} />
            </div>
            <p>把复杂的事，理出一条清晰的线。</p>
            <div className="flow-preview" aria-hidden="true">
              <div className="preview-node start">一个想法</div>
              <span className="vertical-line" />
              <div className="preview-node process">动手试试看</div>
              <div className="fork-lines" />
              <div className="preview-outcomes">
                <span>记录发现</span>
                <span>继续打磨</span>
              </div>
            </div>
            <span className="tool-caption">
              拖拽节点 · 自由连线 · 导出保存 <ArrowRight size={16} />
            </span>
          </Link>
          <div className="tool-stack">
            <Link className="secondary-tool" to="/tools/canvas">
              <span className="tool-symbol">
                <PencilRuler size={25} />
              </span>
              <div>
                <h3>自由画布</h3>
                <p>给还没成形的灵感，一张白纸。</p>
                <span className="mini-label">手绘 / 标注 / PNG 导出</span>
              </div>
              <ArrowUpRight size={20} />
            </Link>
            <Link className="secondary-tool" to="/tools/dev">
              <span className="tool-symbol">
                <Braces size={25} />
              </span>
              <div>
                <h3>开发工具</h3>
                <p>少切几个窗口，多解决一个问题。</p>
                <span className="mini-label">JSON / 编码 / 时间戳 / 哈希</span>
              </div>
              <ArrowUpRight size={20} />
            </Link>
            <Link className="image-strip" to="/images">
              <Image size={20} />
              <div>
                <strong>图片空间</strong>
                <span>存一张图，分享一条链接。</span>
              </div>
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <section className="journal-preview">
        <div className="section-head">
          <h2>最近的笔记</h2>
          <TextLink to="/journal">查看全部</TextLink>
        </div>
        <div className="article-rows">
          {articles.slice(0, 2).map((a) => (
            <Link className="article-row" to={`/journal/${a.slug}`} key={a.slug}>
              <span className="article-category">{a.category}</span>
              <div>
                <h3>{a.title}</h3>
                <p>{a.summary}</p>
              </div>
              <ArrowUpRight size={20} />
            </Link>
          ))}
        </div>
      </section>
      {loading && <p role="status">正在加载最近的笔记…</p>}
      {error && <p className="muted">笔记暂时无法加载，请稍后再试。</p>}
      {!loading && !error && !articles.length && (
        <p className="muted">
          第一篇笔记，正在酝酿。
          <Link className="text-link" to="/admin">
            进入写作后台
          </Link>
        </p>
      )}
      <aside className="home-note">
        <CornerDownRight size={18} />
        <p>这里没有完成时。笔记会更新，工具会变好，想法也会继续生长。</p>
        <span>MAKE / LEARN / SHARE</span>
      </aside>
    </div>
  );
}
