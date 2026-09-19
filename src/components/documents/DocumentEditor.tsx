import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createDocument } from '../../lib/documentClient';
import {
  documentURL,
  validDiagram,
  validStrokes,
  type ToolDocument,
  type ToolContent,
} from '../../lib/toolDocumentData';
import { download } from '../ui';
import { useDocumentDraft } from './useDocumentDraft';
const Flow = lazy(() => import('../../pages/Flow'));
const Canvas = lazy(() => import('../../pages/Canvas'));

export default function DocumentEditor({
  initial,
  token,
  reload,
}: {
  initial: ToolDocument;
  token: string;
  reload: () => void;
}) {
  const draft = useDocumentDraft(initial, token),
    navigate = useNavigate();
  const [title, setTitle] = useState(initial.title),
    [copying, setCopying] = useState(false),
    [actionError, setActionError] = useState('');
  const value: ToolContent = JSON.parse(draft.content);
  async function copy(content: string) {
    setCopying(true);
    setActionError('');
    try {
      const doc = await createDocument(
        token,
        initial.kind,
        `${draft.document.title.slice(0, 76).replace(/[\uD800-\uDBFF]$/, '')} 副本`,
        JSON.parse(content),
      );
      navigate(documentURL(doc));
    } catch (e) {
      setActionError((e as Error).message);
      setCopying(false);
    }
  }
  return (
    <div className="document-editor">
      <div className="document-heading">
        <Link to="/" className="text-link">
          ← 我的文件
        </Link>
        <form
          className="document-name"
          onSubmit={(e) => {
            e.preventDefault();
            void draft.rename(title);
          }}
        >
          <label className="sr-only" htmlFor="document-title">
            文件名称
          </label>
          <input
            id="document-title"
            maxLength={80}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            className="button small"
            disabled={
              draft.busy ||
              Boolean(draft.error) ||
              Boolean(draft.recovery) ||
              title.trim() === draft.document.title
            }
          >
            保存名称
          </button>
        </form>
        <button
          className="button small"
          disabled={copying}
          onClick={() => void copy(draft.recovery?.content ?? draft.content)}
        >
          另存副本
        </button>
        <button
          className="button small"
          onClick={() =>
            download(draft.recovery?.content ?? draft.content, `${draft.document.title}.json`)
          }
        >
          导出当前数据
        </button>
      </div>
      <p className="file-save-status" role="status">
        {draft.error
          ? '自动保存已暂停'
          : draft.recovery
            ? '发现本机恢复副本'
            : draft.busy
              ? '正在保存到云端…'
              : draft.dirty
                ? '等待保存到云端…'
                : '所有修改已保存到云端'}{' '}
        · 本机保留未同步内容
      </p>
      {!draft.backupOK && (
        <p className="notice error" role="alert">
          本机存储不可用，请导出当前数据后再离开。
        </p>
      )}
      {draft.recovery && (
        <div className="file-recovery" role="alert">
          <p>
            发现这份文件的本机未同步内容。
            {draft.recovery.revision !== draft.document.revision
              ? '云端已有新版本，请另存副本，避免覆盖。'
              : '可恢复后继续保存，或使用云端版本。'}
          </p>
          {draft.recovery.revision === draft.document.revision && (
            <button className="button" onClick={draft.restore}>
              恢复本机修改
            </button>
          )}
          <button className="button" onClick={draft.useCloud}>
            使用云端版本
          </button>
          <button
            className="button"
            disabled={copying}
            onClick={() => void copy(draft.recovery!.content)}
          >
            将恢复内容另存副本
          </button>
        </div>
      )}
      {draft.error && (
        <div className="notice error" role="alert">
          <p>{draft.error}</p>
          <button className="button small" disabled={draft.busy} onClick={reload}>
            重新读取文件
          </button>
          <span>当前修改仍在本机，可先“另存副本”或导出。</span>
        </div>
      )}
      {actionError && (
        <p className="notice error" role="alert">
          {actionError}
        </p>
      )}
      {!draft.recovery && (
        <Suspense fallback={<p role="status">正在打开编辑器…</p>}>
          {initial.kind === 'flow' && validDiagram(value) ? (
            <Flow file={{ initial: value, onChange: draft.change }} />
          ) : initial.kind === 'canvas' && validStrokes(value) ? (
            <Canvas file={{ initial: value, onChange: draft.change }} />
          ) : (
            <p role="alert">文件格式无效。</p>
          )}
        </Suspense>
      )}
    </div>
  );
}
