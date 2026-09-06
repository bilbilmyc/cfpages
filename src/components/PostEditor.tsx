import { useEffect, useRef, useState } from 'react';
import WritingBody from './WritingBody';
import { Save, Send, Download } from 'lucide-react';
import { download, Notice } from './ui';
import { requestJSON, type ManagedPost, type PostFields } from '../lib/posts';
import { readLocal, saveLocal } from '../lib/storage';
const empty: PostFields = { title: '', summary: '', category: '日常记录', body: '' };
const fieldsOf = (p: PostFields): PostFields => ({
  title: p.title,
  summary: p.summary,
  category: p.category,
  body: p.body,
});
const valid = (v: unknown): v is PostFields =>
  !!v &&
  typeof v === 'object' &&
  ['title', 'summary', 'category', 'body'].every(
    (k) => typeof (v as Record<string, unknown>)[k] === 'string',
  );
export default function PostEditor({
  initial,
  token,
  onSaved,
  onDirty,
  onBusy,
}: {
  initial: ManagedPost | null;
  token: string;
  onSaved: (p: ManagedPost) => void;
  onDirty: (v: boolean) => void;
  onBusy: (v: boolean) => void;
}) {
  const [record, setRecord] = useState(initial),
    [fields, setFields] = useState<PostFields>(fieldsOf(initial || empty));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const operation = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const [activity, setActivity] = useState('');
  const key = `studio-writing-${record?.id || 'new'}`;
  const [recovery, setRecovery] = useState(() => readLocal<PostFields | null>(key, null, valid));

  const dirty = JSON.stringify(fields) !== JSON.stringify(fieldsOf(record || empty));
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function change(next: PostFields) {
    setFields(next);
    setMessage('');
    if (!saveLocal(key, next)) setError('浏览器恢复副本保存失败，请及时保存草稿或导出文件。');
  }
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!event.repeat && !operation.current) void save('save');
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  });
  useEffect(() => {
    if (!initial) titleRef.current?.focus();
  }, [initial]);
  async function save(action: 'save' | 'publish' | 'unpublish') {
    if (operation.current) return;
    if (!fields.title.trim()) {
      titleRef.current?.focus();
      setError('先给文章起一个标题吧。');
      return;
    }
    if (
      action === 'unpublish' &&
      !window.confirm('撤下后访客将无法阅读这篇文章，草稿仍然保留。确认撤下？')
    )
      return;
    operation.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    setMessage('');
    setActivity(
      action === 'publish' ? '正在发布…' : action === 'unpublish' ? '正在撤下…' : '正在保存草稿…',
    );
    let current = record;
    try {
      if (!current) {
        current = await requestJSON<ManagedPost>(
          '/api/admin/posts',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields),
          },
          token,
        );
        setRecord(current);
        onSaved(current);
        saveLocal(`studio-writing-${current.id}`, fields);
        try {
          localStorage.removeItem('studio-writing-new');
        } catch {
          /* cloud copy is already saved */
        }
        if (action === 'save') {
          setFields(fieldsOf(current));
          setMessage('草稿已保存到云端。');
          setRecovery(null);
          return;
        }
      }
      const saved = await requestJSON<ManagedPost>(
        `/api/admin/posts/${current.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...fields, revision: current.revision, action }),
        },
        token,
      );
      setRecord(saved);
      setFields(fieldsOf(saved));
      onSaved(saved);
      setRecovery(null);
      try {
        localStorage.removeItem(`studio-writing-${saved.id}`);
      } catch {
        /* cloud copy is already saved */
      }
      setMessage(
        action === 'publish'
          ? '文章已发布，访客现在可以阅读。'
          : action === 'unpublish'
            ? '文章已撤下，草稿保留。'
            : saved.published_at
              ? '草稿已保存到云端，公开版本保持不变。'
              : '草稿已保存到云端，准备好了再发布。',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      operation.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  async function upload(file: File | undefined, start: number, end: number) {
    if (!file || operation.current) return;
    operation.current = true;
    setActivity('正在上传图片…');
    setMessage('');
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      if (file.size > 8 * 1024 * 1024) throw Error('图片不能超过 8 MiB。');
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      const image = await requestJSON<{ url: string }>(
        '/api/images',
        {
          method: 'POST',
          headers: { 'Content-Type': file.type, 'X-Filename': encodeURIComponent(file.name) },
          body: file,
        },
        token,
      );
      const description = file.name.replace(/[\[\]\\\r\n]/g, '');
      const markdown = `\n\n![${description}](${image.url})\n\n`;
      change({ ...fields, body: fields.body.slice(0, start) + markdown + fields.body.slice(end) });
      setMessage('图片已插入光标位置，记得保存草稿。');
    } catch (e) {
      setError(`插图失败：${(e as Error).message}`);
    } finally {
      operation.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section className="writing-editor" aria-label="文章编辑器">
      <div className="writing-status">
        <span className="badge">{record?.published_at ? '已有公开版本' : '未发布草稿'}</span>
        <span className="muted small-text">
          {dirty ? '有修改 · 等待保存到云端' : record ? '草稿已保存到云端' : '从一个标题开始'}
        </span>
      </div>
      {recovery && JSON.stringify(recovery) !== JSON.stringify(fields) && (
        <div className="recovery">
          <p>发现这个浏览器中的恢复副本。</p>
          <button
            className="button small"
            disabled={busy}
            onClick={() => {
              change(recovery);
              setRecovery(null);
            }}
          >
            恢复文字
          </button>
          <button className="button small" disabled={busy} onClick={() => setRecovery(null)}>
            暂不恢复
          </button>
        </div>
      )}
      <fieldset disabled={busy} className="writing-fields">
        <label>
          文章标题
          <input
            ref={titleRef}
            value={fields.title}
            onChange={(e) => change({ ...fields, title: e.target.value })}
            placeholder="给这次思考起个名字"
            maxLength={120}
          />
        </label>
        <div className="writing-details">
          <label>
            分类
            <input
              value={fields.category}
              onChange={(e) => change({ ...fields, category: e.target.value })}
              maxLength={40}
              placeholder="例如：开发笔记"
            />
          </label>
          <label>
            摘要
            <textarea
              rows={2}
              value={fields.summary}
              onChange={(e) => change({ ...fields, summary: e.target.value })}
              maxLength={300}
              placeholder="用一两句话介绍这篇文章（可选）"
            />
          </label>
        </div>
        <WritingBody fields={fields} onChange={change} onUpload={upload} />
      </fieldset>
      <div className="writing-status">
        <span className="muted small-text">
          {fields.body.length.toLocaleString()} 字符 · 浏览器保留恢复副本
        </span>
        <button
          className="text-link"
          onClick={() =>
            download(
              `# ${fields.title}\n\n${fields.body}`,
              `${fields.title.replace(/[\\/:*?"<>|]/g, '-') || '未命名文章'}.md`,
              'text/markdown;charset=utf-8',
            )
          }
        >
          <Download size={14} />
          导出 Markdown
        </button>
      </div>
      <div className="writing-actions">
        <div className="writing-action-note">
          <span>
            {record?.published_at
              ? dirty || record.revision !== record.published_revision
                ? '新修改还未公开'
                : '当前文章已公开'
              : '草稿仅自己可见'}
          </span>
          <small>保存草稿不会发布 · Ctrl / ⌘ + S 快速保存</small>
        </div>
        <div className="editor-toolbar">
          <button className="button" disabled={busy} onClick={() => void save('save')}>
            <Save size={16} />
            保存草稿
          </button>
          <button className="button primary" disabled={busy} onClick={() => void save('publish')}>
            <Send size={16} />
            {record?.published_at ? '更新公开文章' : '发布文章'}
          </button>
          {record?.published_at && (
            <>
              <a
                className="text-link"
                href={`/journal/${record.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                查看公开文章 ↗
              </a>
              <button
                className="button small"
                disabled={busy}
                onClick={() => void save('unpublish')}
              >
                撤下文章
              </button>
            </>
          )}
        </div>
        {busy && <p role="status">{activity}</p>}
        {message && <Notice>{message}</Notice>}
        {error && <Notice error>{error}</Notice>}
      </div>
      <p className="muted small-text writing-help">
        “保存草稿”不会改变公开文章；修改完成后点击“
        {record?.published_at ? '更新公开文章' : '发布文章'}
        ”。恢复副本存于当前设备，请勿在共享电脑上留下私人草稿。
      </p>
    </section>
  );
}
