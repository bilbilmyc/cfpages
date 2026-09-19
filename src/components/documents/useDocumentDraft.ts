import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearRecovery,
  documentRequest,
  jsonRequest,
  readRecovery,
  type Recovery,
} from '../../lib/documentClient';
import { saveLocal } from '../../lib/storage';
import type { ToolContent, ToolDocument } from '../../lib/toolDocumentData';

export function useDocumentDraft(initial: ToolDocument, token: string) {
  const [document, setDocument] = useState(initial),
    [content, setContent] = useState(initial.content);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [backupOK, setBackupOK] = useState(true);
  const [candidate] = useState(() => readRecovery(initial.id, initial.kind));
  const [recovery, setRecovery] = useState(
    candidate?.content !== initial.content ? candidate : null,
  );
  // A distinct key per mounted editor prevents another tab from replacing this recovery copy.
  const [backupKey] = useState(() => `studio-file-recovery:${initial.id}:${crypto.randomUUID()}`);
  const current = useRef(content),
    snapshot = useRef(document),
    ownCopy = useRef<Recovery | null>(null);
  const restoring = useRef<Recovery | null>(null),
    active = useRef<AbortController | null>(null),
    mounted = useRef(true);
  const path = `/${initial.id}`;
  const persist = useCallback(
    (text: string, revision: number) => {
      const copy = { key: backupKey, kind: initial.kind, revision, content: text, at: Date.now() };
      ownCopy.current = copy;
      setBackupOK(saveLocal(backupKey, copy));
    },
    [backupKey, initial.kind],
  );
  const change = useCallback(
    (value: ToolContent) => {
      const text = JSON.stringify(value);
      if (text === current.current) return;
      current.current = text;
      setContent(text);
      persist(text, snapshot.current.revision);
    },
    [persist],
  );
  const committed = useCallback(
    (saved: ToolDocument) => {
      snapshot.current = saved;
      setDocument(saved);
      if (current.current === saved.content) {
        if (ownCopy.current) clearRecovery(ownCopy.current);
        if (restoring.current) {
          clearRecovery(restoring.current);
          restoring.current = null;
        }
      } else persist(current.current, saved.revision);
    },
    [persist],
  );
  useEffect(() => {
    mounted.current = true;
    if (candidate?.content === initial.content) clearRecovery(candidate);
    const warn = (event: BeforeUnloadEvent) => {
      if (current.current !== snapshot.current.content) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      mounted.current = false;
      active.current?.abort();
      window.removeEventListener('beforeunload', warn);
    };
  }, [candidate, initial.content]);
  useEffect(() => {
    if (busy || error || recovery || content === document.content) return;
    const timer = setTimeout(async () => {
      if (active.current) return;
      const controller = new AbortController();
      active.current = controller;
      setBusy(true);
      const sent = current.current;
      try {
        const saved = await documentRequest<ToolDocument>(token, path, {
          ...jsonRequest('PUT', { content: sent, revision: snapshot.current.revision }),
          signal: controller.signal,
        });
        if (!controller.signal.aborted && mounted.current) committed(saved);
      } catch (e) {
        if (!controller.signal.aborted && mounted.current) setError((e as Error).message);
      } finally {
        if (active.current === controller) {
          active.current = null;
          if (mounted.current) setBusy(false);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [busy, error, recovery, content, document.content, token, path, committed]);
  const rename = async (title: string) => {
    if (active.current || busy || error || recovery) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    try {
      const saved = await documentRequest<ToolDocument>(token, path, {
        ...jsonRequest('PATCH', { action: 'rename', title, revision: snapshot.current.revision }),
        signal: controller.signal,
      });
      if (!controller.signal.aborted && mounted.current) committed(saved);
    } catch (e) {
      if (!controller.signal.aborted && mounted.current) setError((e as Error).message);
    } finally {
      if (active.current === controller) {
        active.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  };
  const useCloud = () => {
    if (recovery) clearRecovery(recovery);
    setRecovery(null);
  };
  const restore = () => {
    if (!recovery || recovery.revision !== document.revision) return;
    restoring.current = recovery;
    current.current = recovery.content;
    setContent(recovery.content);
    persist(recovery.content, document.revision);
    setRecovery(null);
  };
  return {
    document,
    content,
    busy,
    error,
    backupOK,
    recovery,
    change,
    rename,
    useCloud,
    restore,
    dirty: content !== document.content,
  };
}
