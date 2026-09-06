import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ImagePlus, Columns2, Eye, PenLine } from 'lucide-react';
import type { PostFields } from '../lib/posts';

export default function WritingBody({
  fields,
  onChange,
  onUpload,
}: {
  fields: PostFields;
  onChange: (fields: PostFields) => void;
  onUpload: (file: File | undefined, start: number, end: number) => Promise<void>;
}) {
  const [mode, setMode] = useState<'edit' | 'split' | 'preview'>('edit');
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  function insert(before: string, after = '', placeholder = '文字') {
    const start = bodyRef.current?.selectionStart ?? fields.body.length;
    const end = bodyRef.current?.selectionEnd ?? start;
    const text = fields.body.slice(start, end) || placeholder;
    onChange({
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
  return (
    <>
      <div className="writing-mode-bar">
        <span>正文</span>
        <div className="tabs" role="group" aria-label="编辑视图">
          <button type="button" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>
            <PenLine size={15} />
            编辑
          </button>
          <button type="button" aria-pressed={mode === 'split'} onClick={() => setMode('split')}>
            <Columns2 size={15} />
            对照
          </button>
          <button
            type="button"
            aria-pressed={mode === 'preview'}
            onClick={() => setMode('preview')}
          >
            <Eye size={15} />
            预览
          </button>
        </div>
      </div>
      <div className="writing-tools" aria-label="正文排版">
        <button
          type="button"
          onClick={() => insert('\n## ', '\n', '小标题')}
          disabled={mode === 'preview'}
        >
          小标题
        </button>
        <button type="button" onClick={() => insert('**', '**')} disabled={mode === 'preview'}>
          加粗
        </button>
        <button
          type="button"
          onClick={() => insert('\n- ', '\n', '列表内容')}
          disabled={mode === 'preview'}
        >
          列表
        </button>
        <button
          type="button"
          onClick={() => insert('\n> ', '\n', '引用内容')}
          disabled={mode === 'preview'}
        >
          引用
        </button>
        <button
          type="button"
          onClick={() => insert('\n```\n', '\n```\n', '代码')}
          disabled={mode === 'preview'}
        >
          代码
        </button>
        <label className="file-button" aria-disabled={mode === 'preview'}>
          <ImagePlus size={15} />
          插入图片
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            aria-label="上传文章插图"
            disabled={mode === 'preview'}
            onChange={(e) => {
              const start = bodyRef.current?.selectionStart ?? fields.body.length;
              const end = bodyRef.current?.selectionEnd ?? start;
              void onUpload(e.target.files?.[0], start, end);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <div className={`writing-surface writing-surface-${mode}`}>
        {mode !== 'preview' && (
          <textarea
            ref={bodyRef}
            className="writing-body"
            aria-label="正文"
            value={fields.body}
            onChange={(e) => onChange({ ...fields, body: e.target.value })}
            maxLength={100000}
            placeholder="直接写下第一段文字。空一行开始新段落，选中文字后用上方按钮排版。想看看读者会看到的样子？切换到「对照」或「预览」。"
          />
        )}
        {mode !== 'edit' && (
          <section className="writing-preview prose" aria-label="文章预览">
            <p className="preview-label">阅读预览 · {fields.category || '未分类'}</p>
            <h1>{fields.title || '未命名文章'}</h1>
            {fields.summary && <p className="reader-summary">{fields.summary}</p>}
            <ReactMarkdown>{fields.body || '正文预览会出现在这里。'}</ReactMarkdown>
          </section>
        )}
      </div>
    </>
  );
}
