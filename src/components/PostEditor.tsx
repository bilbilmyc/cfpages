import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Save, Send, Download, ImagePlus } from 'lucide-react';
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
  const [preview, setPreview] = useState(false);
  const key = `studio-writing-${record?.id || 'new'}`;
  const [recovery, setRecovery] = useState(() => readLocal<PostFields | null>(key, null, valid));
  const bodyRef = useRef<HTMLTextAreaElement>(null);
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
  function insert(before: string, after = '', placeholder = '文字') {
    const input = bodyRef.current,
      start = input?.selectionStart ?? fields.body.length,
      end = input?.selectionEnd ?? start;
    const text = fields.body.slice(start, end) || placeholder;
    change({
      ...fields,
      body: fields.body.slice(0, start) + before + text + after + fields.body.slice(end),
    });
    requestAnimationFrame(() => {
      bodyRef.current?.focus();
      bodyRef.current?.setSelectionRange(
        start + before.length,
        start + before.length + text.length,
      );
    });
  }
  async function save(action: 'save' | 'publish' | 'unpublish') {
    if (!fields.title.trim()) {
      setError('先给文章起一个标题吧。');
      return;
    }
    if (
      action === 'unpublish' &&
      !window.confirm('撤下后访客将无法阅读这篇文章，草稿仍然保留。确认撤下？')
    )
      return;
    setBusy(true);
    onBusy(true);
    setError('');
    setMessage('');
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
            : '草稿已保存到云端，公开版本保持不变。',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
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
      change({ ...fields, body: `${fields.body}\n\n![${description}](${image.url})\n` });
      setMessage('图片已上传，并插入正文末尾。');
    } catch (e) {
      setError(`插图失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section className="writing-editor" aria-label="文章编辑器">
      <div className="writing-status">
        <span className="badge">{record?.published_at ? '已有公开版本' : '未发布草稿'}</span>
        <span className="muted small-text">
          {dirty ? '修改尚未保存' : record ? '已保存到云端' : '从一个标题开始'}
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
        <div className="writing-tools" aria-label="正文排版">
          <button type="button" onClick={() => insert('\n## ', '\n', '小标题')} disabled={preview}>
            小标题
          </button>
          <button type="button" onClick={() => insert('**', '**')} disabled={preview}>
            加粗
          </button>
          <button type="button" onClick={() => insert('\n- ', '\n', '列表内容')} disabled={preview}>
            列表
          </button>
          <button type="button" onClick={() => insert('\n> ', '\n', '引用内容')} disabled={preview}>
            引用
          </button>
          <button
            type="button"
            onClick={() => insert('\n```\n', '\n```\n', '代码')}
            disabled={preview}
          >
            代码
          </button>
          <label className="file-button">
            <ImagePlus size={15} />
            插入图片
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              aria-label="上传文章插图"
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <button type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}>
            {preview ? '继续编辑' : '查看预览'}
          </button>
        </div>
        {preview ? (
          <div className="writing-preview prose">
            <h1>{fields.title || '未命名文章'}</h1>
            <p>{fields.summary}</p>
            <ReactMarkdown>{fields.body || '正文预览会出现在这里。'}</ReactMarkdown>
          </div>
        ) : (
          <label>
            正文
            <textarea
              ref={bodyRef}
              className="writing-body"
              value={fields.body}
              onChange={(e) => change({ ...fields, body: e.target.value })}
              maxLength={100000}
              placeholder="直接输入文字即可。空一行开始新段落；选中文字后，可以用上方按钮添加排版。"
            />
          </label>
        )}
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
            <button className="button small" disabled={busy} onClick={() => void save('unpublish')}>
              撤下文章
            </button>
          </>
        )}
      </div>
      {busy && <p role="status">正在保存，请稍候…</p>}
      {message && <Notice>{message}</Notice>}
      {error && <Notice error>{error}</Notice>}
      <p className="muted small-text">
        “保存草稿”不会改变公开文章；修改完成后点击“
        {record?.published_at ? '更新公开文章' : '发布文章'}
        ”。恢复副本存于当前设备，请勿在共享电脑上留下私人草稿。
      </p>
    </section>
  );
}
