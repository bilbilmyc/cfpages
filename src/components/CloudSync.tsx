import { useState, type FormEvent } from 'react';
import { CloudUpload, RefreshCw, Unlink } from 'lucide-react';
import { Notice } from './ui';
import type { CloudSyncControls } from '../lib/cloudDraft';
export default function CloudSync({ sync }: { sync: CloudSyncControls }) {
  const [open, setOpen] = useState(false),
    [credential, setCredential] = useState(''),
    [error, setError] = useState('');
  async function login(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await sync.connect(credential);
      setCredential('');
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (sync.status === 'off') {
    return (
      <>
        <button
          className="button"
          disabled={sync.busy}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <CloudUpload size={16} />
          云同步
        </button>
        {open && (
          <form onSubmit={login}>
            <label className="inline-field">
              管理员密钥
              <input
                type="password"
                autoComplete="off"
                required
                maxLength={512}
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder="输入你保存的 Token"
              />
            </label>
            <button className="button primary" disabled={sync.busy}>
              {sync.busy ? '正在连接…' : '连接云端'}
            </button>
          </form>
        )}
        {(error || sync.error) && <Notice error>{error || sync.error}</Notice>}
      </>
    );
  }
  return (
    <>
      <span className="badge" role="status">
        {sync.busy
          ? '云端同步中…'
          : sync.savedAt
            ? `云端已同步 ${sync.savedAt.slice(11, 19)}`
            : '云端已连接'}
      </span>
      <button
        className="button"
        disabled={sync.busy}
        title="重新读取云端草稿"
        aria-label="重新读取云端草稿"
        onClick={() => void sync.reload()}
      >
        <RefreshCw size={16} />
      </button>
      <button
        className="button"
        title="断开云同步，回到仅本地保存"
        aria-label="断开云同步"
        onClick={sync.disconnect}
      >
        <Unlink size={16} />
      </button>
      {sync.status === 'error' && (
        <Notice error>
          {sync.error}
          <button className="button small" disabled={sync.busy} onClick={() => void sync.reload()}>
            <RefreshCw size={15} />
            重新读取云端
          </button>
        </Notice>
      )}
    </>
  );
}
