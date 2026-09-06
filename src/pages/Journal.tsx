import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Search, ArrowLeft, ArrowUpRight, X, Copy, ArrowUp } from 'lucide-react';
import { PageTitle, Notice } from '../components/ui';
import { requestJSON, type PublicPost } from '../lib/posts';
import { usePublishedPosts } from '../lib/usePublishedPosts';
import { site } from '../config';
import './journal.css';
export default function Journal() {
  const { slug } = useParams();
  return slug ? <Article key={slug} slug={slug} /> : <ArticleList />;
}
function Article({ slug }: { slug: string }) {
  const location = useLocation();
  const from: unknown = location.state?.from;
  const returnTo = typeof from === 'string' && /^\/journal(?:\?|$)/.test(from) ? from : '/journal';
  const [article, setArticle] = useState<PublicPost | null>(null);
  const [error, setError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
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
    <article className="reader" id="article-top">
      <Link className="text-link" to={returnTo}>
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
            {article.category} · {article.date} · 约{' '}
            {Math.max(1, Math.ceil(article.body.length / 500))} 分钟阅读
          </p>
          <h1>{article.title}</h1>
          <p className="reader-summary">{article.summary}</p>
          <div className="prose">
            <ReactMarkdown>{article.body}</ReactMarkdown>
          </div>
          <div className="reader-end">
            <p>
              读到这里，谢谢你。<span>希望其中有一点，对你有用。</span>
            </p>
            <div className="editor-toolbar">
              <Link className="text-link" to={returnTo}>
                <ArrowLeft size={15} />
                继续读其他笔记
              </Link>
              <button
                className="button small"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/journal/${encodeURIComponent(slug)}`,
                    );
                    setCopyMessage('文章链接已复制');
                  } catch {
                    setCopyMessage('复制失败，请复制浏览器地址栏中的链接。');
                  }
                }}
              >
                <Copy size={14} />
                复制链接
              </button>
              <a className="text-link" href="#article-top">
                <ArrowUp size={15} />
                回到开头
              </a>
            </div>
            {copyMessage && <p role="status">{copyMessage}</p>}
          </div>
        </>
      )}
    </article>
  );
}
function ArticleList() {
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') || '').slice(0, 100);
  const rawOffset = params.get('offset') || '0';
  const offset = /^\d{1,6}$/.test(rawOffset) ? Number(rawOffset) : 0;
  function search(value: string) {
    setParams(value ? { q: value } : {}, { replace: true });
  }
  function page(value: number) {
    setParams({ ...(query ? { q: query } : {}), offset: String(value) });
  }
  const { posts, next, loading, error } = usePublishedPosts(query, offset);
  return (
    <div className="journal-page">
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
              search(e.target.value);
            }}
            placeholder="搜索文章、正文或分类…"
          />
        </label>
        {query && (
          <button className="button small" onClick={() => search('')}>
            <X size={14} />
            清除搜索
          </button>
        )}
        {!loading && !error && (
          <p className="muted small-text" role="status">
            {query ? `“${query}”的搜索结果` : '按发布时间排列'} · 本页 {posts.length} 篇
          </p>
        )}
      </div>
      {loading ? (
        <p role="status">正在整理笔记…</p>
      ) : error ? (
        <Notice error>{error}</Notice>
      ) : (
        <>
          <div className="article-rows">
            {posts.map((a) => (
              <Link
                key={a.slug}
                className="article-row"
                to={`/journal/${a.slug}`}
                state={{ from: `/journal${params.size ? `?${params.toString()}` : ''}` }}
              >
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
            </div>
          )}
          <div className="editor-toolbar">
            {offset > 0 && (
              <button className="button" onClick={() => page(Math.max(0, offset - 20))}>
                上一页
              </button>
            )}
            {next !== null && (
              <button className="button" onClick={() => page(next)}>
                下一页
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
