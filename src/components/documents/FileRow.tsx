import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Copy, RotateCcw } from 'lucide-react';
import { readRecovery } from '../../lib/documentClient';
import { documentURL, toolNames, type ToolDocumentSummary } from '../../lib/toolDocumentData';

export default function FileRow({
  doc,
  busy,
  update,
  copy,
}: {
  doc: ToolDocumentSummary;
  busy: boolean;
  update: (action: 'rename' | 'archive' | 'restore', title?: string) => Promise<boolean>;
  copy: () => void;
}) {
  const [editing, setEditing] = useState(false),
    [name, setName] = useState(doc.title);
  return (
    <li className="file-row">
      <div className="file-details">
        {editing ? (
          <form
            className="file-rename"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await update('rename', name)) setEditing(false);
            }}
          >
            <label className="sr-only" htmlFor={`rename-${doc.id}`}>
              新文件名称
            </label>
            <input
              id={`rename-${doc.id}`}
              autoFocus
              maxLength={80}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="button small" disabled={busy}>
              保存名称
            </button>
            <button type="button" className="button small" onClick={() => setEditing(false)}>
              取消
            </button>
          </form>
        ) : (
          <Link className="file-name" to={documentURL(doc)}>
            {doc.title}
          </Link>
        )}
        <span className="file-meta">
          {toolNames[doc.kind]} · 最近打开{' '}
          {new Date(doc.last_opened_at).toLocaleString('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {readRecovery(doc.id, doc.kind) && ' · 有本机恢复副本'}
        </span>
      </div>
      <div className="file-actions">
        {doc.archived_at ? (
          <button className="button small" disabled={busy} onClick={() => void update('restore')}>
            <RotateCcw size={14} />
            恢复
          </button>
        ) : (
          <>
            <button
              className="button small"
              disabled={busy}
              onClick={() => {
                setName(doc.title);
                setEditing(true);
              }}
            >
              重命名
            </button>
            <button className="button small" disabled={busy} onClick={copy}>
              <Copy size={14} />
              复制
            </button>
            <button className="button small" disabled={busy} onClick={() => void update('archive')}>
              <Archive size={14} />
              归档
            </button>
          </>
        )}
      </div>
    </li>
  );
}
