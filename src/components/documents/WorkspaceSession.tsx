import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { requestJSON } from '../../lib/posts';
import { documentRequest } from '../../lib/documentClient';

type Session = {
  token: string;
  note: string;
  connect: (value: string) => Promise<void>;
  disconnect: () => void;
};
const Context = createContext<Session | null>(null);
export function WorkspaceSession({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(''),
    [note, setNote] = useState('');
  const pending = useRef<AbortController | null>(null);
  const connect = useCallback(async (value: string) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    await requestJSON('/api/admin/session', { signal: controller.signal }, value);
    const imported = await documentRequest<{ imported: number; skipped: string[] }>(
      value,
      '/import-legacy',
      { method: 'POST', signal: controller.signal },
    );
    if (controller.signal.aborted) return;
    setToken(value);
    setNote(
      imported.skipped.length
        ? '部分旧云草稿格式不兼容，原数据仍保留在对应工具的云同步中。'
        : imported.imported
          ? `已导入 ${imported.imported} 份旧云草稿，原数据仍保留。`
          : '',
    );
  }, []);
  const disconnect = useCallback(() => {
    pending.current?.abort();
    setToken('');
    setNote('');
  }, []);
  useEffect(() => () => pending.current?.abort(), []);
  return (
    <Context.Provider value={{ token, note, connect, disconnect }}>{children}</Context.Provider>
  );
}
export function useWorkspaceSession() {
  const session = useContext(Context);
  if (!session) throw Error('Missing workspace session');
  return session;
}
export function ConnectWorkspace() {
  const { connect } = useWorkspaceSession();
  const [credential, setCredential] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <div className="file-connect">
      <p>连接自己的云端文件库，在另一台设备继续编辑。密钥仅保留在当前页面，刷新后重新连接。</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            await connect(credential);
            setCredential('');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="inline-field">
          管理员密钥
          <input
            type="password"
            autoComplete="off"
            required
            maxLength={512}
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
          />
        </label>
        <button className="button primary" disabled={busy}>
          {busy ? '正在连接…' : '连接文件库'}
        </button>
      </form>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
