import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus2 } from 'lucide-react';
import FileRow from './FileRow';
import { createDocument, documentRequest, jsonRequest } from '../../lib/documentClient';
import {
  documentURL,
  emptyContent,
  toolNames,
  type ToolDocumentSummary,
  type ToolDocument,
  type ToolKind,
} from '../../lib/toolDocumentData';
import { ConnectWorkspace, useWorkspaceSession } from './WorkspaceSession';
import './documents.css';

export default function DocumentLibrary() {
  const { token, note, disconnect } = useWorkspaceSession(),
    navigate = useNavigate();
  const [docs, setDocs] = useState<ToolDocumentSummary[]>([]),
    [next, setNext] = useState<number | null>(null);
  const [query, setQuery] = useState(''),
    [kind, setKind] = useState(''),
    [archived, setArchived] = useState(false);
  const [offset, setOffset] = useState(0),
    [refresh, setRefresh] = useState(0),
    [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  useEffect(() => {
    setDocs([]);
    setOffset(0);
    setNext(null);
    setError('');
    setMessage('');
  }, [token]);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setLoading(true);
    if (!offset) setDocs([]);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: query,
          kind,
          archived: archived ? '1' : '0',
          offset: String(offset),
        });
        const data = await documentRequest<{
          documents: ToolDocumentSummary[];
          next: number | null;
        }>(token, `?${params}`, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setDocs((previous) =>
            offset
              ? [...new Map([...previous, ...data.documents].map((doc) => [doc.id, doc])).values()]
              : data.documents,
          );
          setNext(data.next);
          setError('');
        }
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [token, query, kind, archived, offset, refresh]);
  const reload = () => {
    setOffset(0);
    setRefresh((n) => n + 1);
  };
  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await operation();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const create = (kind: ToolKind) =>
    run(async () => {
      const doc = await createDocument(token, kind, `未命名${toolNames[kind]}`, emptyContent(kind));
      navigate(documentURL(doc));
    });
  const update = (
    doc: ToolDocumentSummary,
    action: 'rename' | 'archive' | 'restore',
    title?: string,
  ) =>
    run(async () => {
      await documentRequest(
        token,
        `/${doc.id}`,
        jsonRequest('PATCH', { action, title, revision: doc.revision }),
      );
      setMessage(
        action === 'archive'
          ? '文件已归档，可在“已归档”中恢复。'
          : action === 'restore'
            ? '文件已恢复。'
            : '文件已重命名。',
      );
      reload();
    });
  return (
    <section className="file-library" aria-labelledby="files-title">
      <div className="panel-heading">
        <div>
          <h2 id="files-title">我的文件</h2>
          <p>命名、整理，再接着上次的工作。</p>
        </div>
        {token && (
          <button className="button small" disabled={busy} onClick={disconnect}>
            断开文件库
          </button>
        )}
      </div>
      {!token ? (
        <ConnectWorkspace />
      ) : (
        <>
          <div className="file-toolbar">
            <button className="button primary" disabled={busy} onClick={() => void create('flow')}>
              <FilePlus2 size={16} />
              新建流程图
            </button>
            <button className="button" disabled={busy} onClick={() => void create('canvas')}>
              <FilePlus2 size={16} />
              新建画布
            </button>
            <button
              className="button"
              aria-pressed={archived}
              disabled={busy}
              onClick={() => {
                setArchived(!archived);
                setOffset(0);
              }}
            >
              {archived ? '返回全部文件' : '已归档'}
            </button>
            <button className="button" disabled={loading || busy} onClick={reload}>
              刷新文件
            </button>
          </div>
          <div className="file-filters">
            <label>
              搜索文件
              <input
                type="search"
                value={query}
                maxLength={80}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOffset(0);
                }}
              />
            </label>
            <label>
              文件类型
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="">全部类型</option>
                <option value="flow">流程图</option>
                <option value="canvas">画布</option>
              </select>
            </label>
            <span>按最近打开排序</span>
          </div>
          {note && <p className="muted small-text">{note}</p>}
          {loading && <p role="status">正在加载文件…</p>}
          {!loading && !error && !docs.length && (
            <p className="compact-empty">
              {archived ? '暂无归档文件。' : '暂无匹配文件，新建一份开始工作。'}
            </p>
          )}
          <ul className="file-list" aria-label={archived ? '归档文件' : '云端文件'}>
            {docs.map((doc) => (
              <FileRow
                key={doc.id}
                doc={doc}
                busy={busy}
                update={(action, title) => update(doc, action, title)}
                copy={() =>
                  void run(async () => {
                    const copy = await documentRequest<ToolDocument>(
                      token,
                      `/${doc.id}/duplicate`,
                      { method: 'POST' },
                    );
                    setMessage(`已复制为「${copy.title}」。`);
                    reload();
                  })
                }
              />
            ))}
          </ul>
          {next !== null && (
            <button className="button" disabled={loading || busy} onClick={() => setOffset(next)}>
              加载更多文件
            </button>
          )}
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="notice error">
              {error}{' '}
              <button className="button small" onClick={reload}>
                重新加载文件
              </button>
            </p>
          )}
        </>
      )}
    </section>
  );
}
