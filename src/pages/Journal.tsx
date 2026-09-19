import { lazy } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { PageTitle, Notice } from '../components/ui';
import { usePublishedPosts } from '../lib/usePublishedPosts';
import ArticleRows from '../components/ArticleRows';
import './journal.css';
const Article = lazy(() => import('../components/ArticleReader'));
export default function Journal() {
  const { slug } = useParams();
  return slug ? <Article key={slug} slug={slug} /> : <ArticleList />;
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
  const { posts, next, loading, error, retry } = usePublishedPosts(query, offset);
  return (
    <div className="journal-page">
      <PageTitle title="文章与分享" description="技术笔记、实践记录与想法。按关键词查找文章。" />
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
        <div>
          <Notice error>{error}</Notice>
          <button className="button" onClick={retry}>
            重新加载
          </button>
        </div>
      ) : (
        <>
          <ArticleRows
            posts={posts}
            from={'/journal' + (params.size ? '?' + params.toString() : '')}
          />
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
