import { useState, type ReactNode } from 'react';
import { Copy, Check, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
export function PageTitle({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </header>
  );
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <p className={`notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
export function CopyButton({ text, label = '复制' }: { text: string; label?: string }) {
  const [status, setStatus] = useState('');
  return (
    <>
      <button
        className="button small"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setStatus('已复制');
          } catch {
            setStatus('复制失败，请手动选择文本复制');
          }
        }}
      >
        {status === '已复制' ? <Check size={15} /> : <Copy size={15} />}
        {label}
      </button>
      <span className="muted small-text" role="status">
        {status}
      </span>
    </>
  );
}
export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowUpRight size={17} />
    </Link>
  );
}
export function download(content: BlobPart, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
