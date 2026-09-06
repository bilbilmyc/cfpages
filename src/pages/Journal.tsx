import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Search, ArrowLeft, ArrowUpRight } from 'lucide-react';
import { articles } from '../content/articles';
import { PageTitle } from '../components/ui';
export default function Journal() {
  const { slug } = useParams();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  if (slug) {
    const article = articles.find((a) => a.slug === slug);
    return article ? (
      <article className="reader">
        <Link className="text-link" to="/journal">
          <ArrowLeft size={16} />
          返回文章
        </Link>
        <p className="article-meta">
          {article.category} · {article.date}
          {article.sample ? ' · 示例内容' : ''}
        </p>
        <h1>{article.title}</h1>
        <p className="reader-summary">{article.summary}</p>
        <div className="prose">
          <ReactMarkdown>{article.body}</ReactMarkdown>
        </div>
      </article>
    ) : (
      <div className="empty">
        <h1>没有找到这篇文章</h1>
        <Link to="/journal">返回文章列表</Link>
      </div>
    );
  }
  const filtered = articles.filter(
    (a) =>
      (category === '全部' || a.category === category) &&
      `${a.title}${a.summary}${a.body}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        title="文章与分享"
        description="把遇到的问题、学到的东西和偶尔闪过的灵感，留在这里。"
      />
      <div className="filter-bar">
        <div className="tabs" aria-label="文章分类">
          {['全部', ...new Set(articles.map((a) => a.category))].map((c) => (
            <button key={c} aria-pressed={c === category} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={17} />
          <input
            aria-label="搜索文章"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索笔记…"
          />
        </label>
      </div>
      {articles.some((a) => a.sample) && (
        <p className="muted small-text">标注“示例”的文章用于展示阅读体验。</p>
      )}
      <div className="article-rows">
        {filtered.map((a) => (
          <Link key={a.slug} className="article-row" to={`/journal/${a.slug}`}>
            <span className="article-category">{a.category}</span>
            <div>
              <h2>{a.title}</h2>
              <p>{a.summary}</p>
              <small>
                {a.date}
                {a.sample ? ' · 示例' : ''}
              </small>
            </div>
            <ArrowUpRight size={22} />
          </Link>
        ))}
      </div>
      {!filtered.length && (
        <div className="empty">
          <h2>暂时没有匹配的笔记</h2>
          <p>换一个关键词，或查看全部分类。</p>
          <button
            className="button"
            onClick={() => {
              setQuery('');
              setCategory('全部');
            }}
          >
            清除筛选
          </button>
        </div>
      )}
    </>
  );
}
