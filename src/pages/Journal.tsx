import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Search, ArrowLeft, ArrowUpRight } from 'lucide-react';
import { PageTitle, Notice } from '../components/ui';
import { requestJSON, type PublicPost } from '../lib/posts';
import { usePublishedPosts } from '../lib/usePublishedPosts';
import { site } from '../config';
export default function Journal() {
  const { slug } = useParams();
  return slug ? <Article key={slug} slug={slug} /> : <ArticleList />;
}
function Article({ slug }: { slug: string }) {
  const [article, setArticle] = useState<PublicPost | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    requestJSON<PublicPost>(`/api/posts/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((a) => {
        setArticle(a);
        document.title = `${a.title} · ${site.name}`;
        document.querySelector('meta[name="description"]')?.setAttribute('content', a.summary);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [slug]);
  return (
    <article className="reader">
      <Link className="text-link" to="/journal">
        <ArrowLeft size={16} />
        返回文章
      </Link>
      {error ? (
        <Notice error>{error}</Notice>
      ) : !article ? (
        <p role="status">正在打开文章…</p>
      ) : (
        <>
          <p className="article-meta">
            {article.category} · {article.date}
          </p>
          <h1>{article.title}</h1>
          <p className="reader-summary">{article.summary}</p>
          <div className="prose">
            <ReactMarkdown>{article.body}</ReactMarkdown>
          </div>
        </>
      )}
    </article>
  );
}
function ArticleList() {
  const [query, setQuery] = useState(''),
    [offset, setOffset] = useState(0);
  const { posts, next, loading, error } = usePublishedPosts(query, offset);
  return (
    <>
      <PageTitle
        title="文章与分享"
        description="把遇到的问题、学到的东西和偶尔闪过的灵感，留在这里。"
      />
      <div className="filter-bar">
        <label className="search">
          <Search size={17} />
          <input
            aria-label="搜索文章"
            value={query}
            maxLength={100}
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
            }}
            placeholder="搜索文章、正文或分类…"
          />
        </label>
        <Link className="text-link" to="/admin">
          站主写作 <ArrowUpRight size={16} />
        </Link>
      </div>
      {loading ? (
        <p role="status">正在整理笔记…</p>
      ) : error ? (
        <Notice error>{error}</Notice>
      ) : (
        <>
          <div className="article-rows">
            {posts.map((a) => (
              <Link key={a.slug} className="article-row" to={`/journal/${a.slug}`}>
                <span className="article-category">{a.category}</span>
                <div>
                  <h2>{a.title}</h2>
                  <p>{a.summary}</p>
                  <small>{a.date}</small>
                </div>
                <ArrowUpRight size={22} />
              </Link>
            ))}
          </div>
          {!posts.length && (
            <div className="empty">
              <h2>{query ? '没有匹配的笔记' : '第一篇笔记，正在酝酿'}</h2>
              <p>{query ? '试试其他关键词。' : '发布后的文章会出现在这里。'}</p>
              {query && (
                <button className="button" onClick={() => setQuery('')}>
                  清除搜索
                </button>
              )}
            </div>
          )}
          <div className="editor-toolbar">
            {offset > 0 && (
              <button className="button" onClick={() => setOffset(Math.max(0, offset - 20))}>
                上一页
              </button>
            )}
            {next !== null && (
              <button className="button" onClick={() => setOffset(next)}>
                下一页
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
