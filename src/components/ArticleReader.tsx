import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Copy, ArrowUp } from 'lucide-react';
import { Notice } from './ui';
import { requestJSON, type PublicPost } from '../lib/posts';
import { site } from '../config';
export default function ArticleReader({ slug }: { slug: string }) {
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
