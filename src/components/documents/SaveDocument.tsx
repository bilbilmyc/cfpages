import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createDocument } from '../../lib/documentClient';
import {
  documentURL,
  toolNames,
  type ToolContent,
  type ToolKind,
} from '../../lib/toolDocumentData';
import { ConnectWorkspace, useWorkspaceSession } from './WorkspaceSession';

export default function SaveDocument({ kind, content }: { kind: ToolKind; content: ToolContent }) {
  const { token } = useWorkspaceSession(),
    navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState(`未命名${toolNames[kind]}`);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <div className="save-document">
      <button className="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        存为新文件
      </button>
      {open && (
        <div className="save-document-form">
          {token ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  const doc = await createDocument(token, kind, title, content);
                  navigate(documentURL(doc));
                } catch (e) {
                  setError((e as Error).message);
                  setBusy(false);
                }
              }}
            >
              <label className="inline-field">
                文件名称
                <input
                  value={title}
                  maxLength={80}
                  required
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <button className="button primary" disabled={busy}>
                保存为云端文件
              </button>
            </form>
          ) : (
            <ConnectWorkspace />
          )}
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
