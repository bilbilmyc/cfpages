import { useCallback, useEffect, useRef, useState } from 'react';
import { requestJSON } from './posts';

// Shared only within this JS page lifetime. Never persist administrator credentials.
let sessionCredential = '';
export type SyncStatus = 'off' | 'on' | 'error';
type RemoteDraft = { content: string | null; revision: number; updated_at: string | null };
export type CloudSyncControls = {
  status: SyncStatus;
  busy: boolean;
  savedAt: string | null;
  error: string;
  connect: (credential: string) => Promise<void>;
  disconnect: () => void;
  reload: () => Promise<void>;
};
export function useCloudDraft<T>(
  key: 'flow' | 'canvas',
  value: T,
  apply: (remote: T) => void,
  isValid: (v: unknown) => v is T,
  enabled = true,
): CloudSyncControls {
  const [status, setStatus] = useState<SyncStatus>('off');
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState('');
  const token = useRef(''),
    revision = useRef(0),
    lastSynced = useRef<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const handlers = useRef({ apply, isValid });
  handlers.current = { apply, isValid };
  const current = useRef(value);
  current.current = value;
  const path = '/api/admin/drafts/' + key;

  const read = useCallback(
    async (credential: string) => {
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      setBusy(true);
      setError('');
      try {
        const data = await requestJSON<RemoteDraft>(
          path,
          { signal: controller.signal },
          credential,
        );
        if (controller.signal.aborted) return;
        let matched: string | null = null;
        if (data.content !== null) {
          const remote: unknown = JSON.parse(data.content);
          if (!handlers.current.isValid(remote))
            throw Error('云端草稿格式不兼容。已暂停同步，当前本地内容仍保留。');
          const remoteText = JSON.stringify(remote);
          if (remoteText === JSON.stringify(current.current)) matched = remoteText;
          else if (
            window.confirm(
              '云端已有这份工具的草稿。\n\n确定：用云端内容替换当前页面。\n取消：保留当前内容，稍后推送到云端。',
            )
          ) {
            handlers.current.apply(remote);
            matched = remoteText;
          }
        }
        token.current = credential;
        sessionCredential = credential;
        revision.current = data.revision;
        lastSynced.current = matched;
        setSavedAt(data.updated_at);
        setStatus('on');
      } catch (e) {
        if (!controller.signal.aborted) {
          setStatus(token.current ? 'error' : 'off');
          setError((e as Error).message);
          throw e;
        }
      } finally {
        if (active.current === controller) {
          active.current = null;
          setBusy(false);
        }
      }
    },
    [path],
  );

  useEffect(() => {
    if (!enabled || status !== 'on' || busy) return;
    const timer = setTimeout(async () => {
      if (active.current || !token.current) return;
      const content = JSON.stringify(current.current);
      if (content === lastSynced.current) return;
      const controller = new AbortController();
      active.current = controller;
      setBusy(true);
      try {
        const result = await requestJSON<{ revision: number; updated_at: string }>(
          path,
          {
            method: 'PUT',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, revision: revision.current }),
          },
          token.current,
        );
        if (controller.signal.aborted) return;
        revision.current = result.revision;
        lastSynced.current = content;
        setSavedAt(result.updated_at);
        setError('');
      } catch (e) {
        if (!controller.signal.aborted) {
          setStatus('error');
          setError((e as Error).message);
        }
      } finally {
        if (active.current === controller) {
          active.current = null;
          setBusy(false);
        }
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [value, status, busy, path, enabled]);

  const disconnect = useCallback(() => {
    active.current?.abort();
    active.current = null;
    token.current = '';
    sessionCredential = '';
    revision.current = 0;
    lastSynced.current = null;
    setSavedAt(null);
    setStatus('off');
    setBusy(false);
    setError('');
  }, []);
  const reload = useCallback(async () => {
    if (!enabled) return;
    const credential = token.current || sessionCredential;
    if (!credential) return;
    try {
      await read(credential);
    } catch {
      /* read exposes the error to the UI */
    }
  }, [read, enabled]);
  useEffect(() => {
    try {
      sessionStorage.removeItem('studio-tool-sync-token');
    } catch {
      /* storage may be disabled */
    }
    void reload();
    return () => {
      active.current?.abort();
      active.current = null;
    };
  }, [reload]);
  return { status, busy, savedAt, error, connect: read, disconnect, reload };
}
