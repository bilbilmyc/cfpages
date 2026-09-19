import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { documentRequest, jsonRequest } from '../lib/documentClient';
import { validContent, toolNames, type ToolDocument, type ToolKind } from '../lib/toolDocumentData';
import { ConnectWorkspace, useWorkspaceSession } from '../components/documents/WorkspaceSession';
import DocumentEditor from '../components/documents/DocumentEditor';
import '../components/documents/documents.css';

export default function DocumentPage({ kind }: { kind: ToolKind }) {
  const { id } = useParams(),
    { token } = useWorkspaceSession();
  const [loaded, setLoaded] = useState<ToolDocument | null>(null),
    [error, setError] = useState('');
  const [reload, setReload] = useState(0),
    [restoring, setRestoring] = useState(false);
  useEffect(() => {
    setLoaded(null);
    setError('');
    if (!token || !id) return;
    const controller = new AbortController();
    void documentRequest<ToolDocument>(token, `/${encodeURIComponent(id)}/open`, {
      method: 'POST',
      signal: controller.signal,
    })
      .then((doc) => {
        if (doc.kind !== kind || !validContent(kind, JSON.parse(doc.content)))
          throw Error('文件类型或内容不兼容，请从首页打开正确的文件。');
        if (!controller.signal.aborted) setLoaded(doc);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id, kind, token, reload]);
  if (!token)
    return (
      <section className="file-library">
        <h1>打开{toolNames[kind]}文件</h1>
        <ConnectWorkspace />
        <Link to="/">返回我的文件</Link>
      </section>
    );
  if (error)
    return (
      <section className="file-library">
        <h1>暂时无法打开文件</h1>
        <p role="alert">{error}</p>
        <button className="button" onClick={() => setReload((v) => v + 1)}>
          重试打开
        </button>{' '}
        <Link to="/">返回我的文件</Link>
      </section>
    );
  if (!loaded || loaded.id !== id) return <p role="status">正在读取云端文件…</p>;
  if (loaded.archived_at)
    return (
      <section className="file-library">
        <h1>{loaded.title}</h1>
        <p>此文件已归档，内容仍然保留。恢复后可继续编辑。</p>
        <button
          className="button"
          disabled={restoring}
          onClick={async () => {
            setRestoring(true);
            try {
              await documentRequest(
                token,
                `/${loaded.id}`,
                jsonRequest('PATCH', { action: 'restore', revision: loaded.revision }),
              );
              setReload((v) => v + 1);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setRestoring(false);
            }
          }}
        >
          恢复文件
        </button>{' '}
        <Link to="/">返回我的文件</Link>
      </section>
    );
  return (
    <DocumentEditor
      key={`${loaded.id}:${reload}`}
      initial={loaded}
      token={token}
      reload={() => setReload((v) => v + 1)}
    />
  );
}
