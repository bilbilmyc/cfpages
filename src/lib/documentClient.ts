import { requestJSON } from './posts';
import {
  validContent,
  type ToolContent,
  type ToolDocument,
  type ToolKind,
} from './toolDocumentData';

export const documentsPath = '/api/admin/documents';
export function documentRequest<T>(token: string, path = '', init: RequestInit = {}) {
  return requestJSON<T>(documentsPath + path, init, token);
}
export function jsonRequest(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
export function createDocument(token: string, kind: ToolKind, title: string, content: ToolContent) {
  return documentRequest<ToolDocument>(
    token,
    '',
    jsonRequest('POST', { kind, title, content: JSON.stringify(content) }),
  );
}
export type Recovery = {
  key: string;
  kind: ToolKind;
  revision: number;
  content: string;
  at: number;
};
export function readRecovery(id: string, kind: ToolKind): Recovery | null {
  try {
    const copies: Recovery[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)!;
      if (!key.startsWith(`studio-file-recovery:${id}:`)) continue;
      try {
        const value = JSON.parse(localStorage.getItem(key)!);
        if (
          value.kind === kind &&
          Number.isSafeInteger(value.revision) &&
          value.revision > 0 &&
          Number.isFinite(value.at) &&
          typeof value.content === 'string' &&
          validContent(kind, JSON.parse(value.content))
        )
          copies.push({ ...value, key });
      } catch {
        /* Ignore malformed copies without deleting them. */
      }
    }
    return copies.sort((a, b) => b.at - a.at)[0] || null;
  } catch {
    return null;
  }
}
export function clearRecovery(copy: Recovery) {
  try {
    const current = JSON.parse(localStorage.getItem(copy.key) || 'null');
    if (
      current?.content === copy.content &&
      current?.revision === copy.revision &&
      current?.at === copy.at
    )
      localStorage.removeItem(copy.key);
  } catch {
    /* A failed cleanup must not turn a successful save into an error. */
  }
}
