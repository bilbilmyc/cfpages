import { useState } from 'react';
import { ShieldCheck, ArrowRight, RefreshCw } from 'lucide-react';
import { PageTitle, Notice, CopyButton } from '../components/ui';
import { transform, type Operation } from '../lib/transforms';
const groups = [
  {
    id: 'json',
    name: 'JSON',
    help: '格式化、压缩与语法检查。大整数 ID 建议使用字符串，避免精度丢失。',
    ops: [
      ['format', '格式化'],
      ['minify', '压缩'],
    ],
  },
  {
    id: 'base64',
    name: 'Base64',
    help: '支持中文与 UTF-8 文本。Base64 是编码方式，不是加密。',
    ops: [
      ['base64-encode', '编码'],
      ['base64-decode', '解码'],
    ],
  },
  {
    id: 'url',
    name: 'URL 编码',
    help: '对单个 URL 参数进行编码或解码。',
    ops: [
      ['url-encode', '编码'],
      ['url-decode', '解码'],
    ],
  },
  {
    id: 'timestamp',
    name: '时间戳',
    help: '支持秒、毫秒时间戳与包含时区的 ISO 日期。',
    ops: [['timestamp', '转换']],
  },
  {
    id: 'hash',
    name: 'SHA-256',
    help: '计算输入文本的 SHA-256 摘要。不要用于直接存储登录密码。',
    ops: [['sha256', '计算哈希']],
  },
];
export default function DevTools() {
  const [group, setGroup] = useState(groups[0]);
  const [input, setInput] = useState('{"hello": "世界", "ideas": ["记录", "创造"]}');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(op: Operation) {
    setBusy(true);
    setError('');
    try {
      if (input.length > 1000000) throw Error('文本过长，请限制在 100 万字符以内。');
      setOutput(await transform(op, input));
    } catch (e) {
      setError(`处理失败：${(e as Error).message}`);
      setOutput('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle title="开发工具" description="日常开发里的小事，在这里顺手解决。" />
      <div className="tabs tool-tabs">
        {groups.map((g) => (
          <button
            key={g.id}
            aria-pressed={group.id === g.id}
            onClick={() => {
              setGroup(g);
              setInput('');
              setOutput('');
              setError('');
            }}
          >
            {g.name}
          </button>
        ))}
      </div>
      <p className="tool-help">{group.help}</p>
      <div className="code-panels">
        <div>
          <label htmlFor="tool-input">输入</label>
          <textarea
            id="tool-input"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              group.id === 'timestamp' ? '2026-09-06T12:00:00+08:00' : '粘贴需要处理的内容…'
            }
          />
        </div>
        <div>
          <label htmlFor="tool-output">结果</label>
          <textarea
            id="tool-output"
            readOnly
            spellCheck={false}
            value={output}
            placeholder="处理结果会出现在这里"
          />
        </div>
      </div>
      <div className="editor-toolbar">
        {group.ops.map(([op, label]) => (
          <button
            className="button primary"
            key={op}
            disabled={busy}
            onClick={() => void run(op as Operation)}
          >
            {busy ? '处理中…' : label}
            <ArrowRight size={16} />
          </button>
        ))}
        {group.id === 'timestamp' && (
          <button className="button" onClick={() => setInput(String(Date.now()))}>
            填入当前时间
          </button>
        )}
        <button
          className="button"
          onClick={() => {
            setInput(output);
            setOutput('');
            setError('');
          }}
          disabled={!output}
        >
          <RefreshCw size={16} />
          结果作为输入
        </button>
        <div className="toolbar-spacer" />
        {output && <CopyButton text={output} label="复制结果" />}
      </div>
      {error && <Notice error>{error}</Notice>}
      <p className="privacy-note">
        <ShieldCheck size={17} />
        输入仅在本地处理，不会上传到服务器。
      </p>
    </>
  );
}
