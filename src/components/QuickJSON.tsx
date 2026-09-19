import { useState } from 'react';
import { ArrowRight, Check, Copy, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { transform } from '../lib/transforms';

export default function QuickJSON() {
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(operation: 'format' | 'minify') {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      if (input.length > 1000000) throw Error('请限制在 100 万字符以内。');
      setInput(await transform(operation, input));
      setMessage(operation === 'format' ? '已格式化' : '已压缩');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="quick-json" aria-labelledby="quick-json-title">
      <div className="panel-heading">
        <div>
          <h2 id="quick-json-title">快速处理 JSON</h2>
          <p>粘贴即用，内容留在当前浏览器。</p>
        </div>
        <Link className="text-link" to="/tools/dev">
          完整工具 <ArrowRight size={14} />
        </Link>
      </div>
      <label className="sr-only" htmlFor="quick-json-input">
        JSON 内容
      </label>
      <textarea
        id="quick-json-input"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setError('');
          setMessage('');
        }}
        spellCheck={false}
        placeholder={'粘贴 JSON，例如：\n{"name":"Soren","tools":["JSON","流程图","画布"]}'}
      />
      <div className="quick-json-actions">
        <button
          className="button primary small"
          disabled={!input.trim() || busy}
          onClick={() => void run('format')}
        >
          格式化
        </button>
        <button
          className="button small"
          disabled={!input.trim() || busy}
          onClick={() => void run('minify')}
        >
          压缩
        </button>
        <button
          className="button small"
          disabled={!input || busy}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(input);
              setMessage('已复制');
              setError('');
            } catch {
              setError('复制失败，请手动选择文本复制。');
            }
          }}
        >
          <Copy size={14} />
          复制
        </button>
        <button
          className="icon-button"
          aria-label="清空 JSON"
          disabled={!input || busy}
          onClick={() => {
            setInput('');
            setMessage('');
            setError('');
          }}
        >
          <RotateCcw size={15} />
        </button>
        {message && (
          <span className="inline-success" role="status">
            <Check size={14} />
            {message}
          </span>
        )}
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
