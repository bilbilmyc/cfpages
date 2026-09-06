import { useEffect, useState } from 'react';
import { Upload, LockKeyhole, Image as ImageIcon, Archive } from 'lucide-react';
import { PageTitle, Notice, CopyButton } from '../components/ui';
import { useAdminSession } from '../components/AdminArea';
type ImageRecord = { id: string; filename: string; url: string; size: number; created_at: string };
async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  const data = (await r.json().catch(() => {
    throw Error('无法连接图片服务，请使用完整的 Pages 运行环境。');
  })) as {
    error?: string;
  };
  if (!r.ok) throw Error(data.error || '请求失败');
  return data as T;
}
export default function Images() {
  const { token, setBusy: sessionBusy } = useAdminSession();
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState<ImageRecord | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((d) => setConfigured(Boolean((d as { configured?: boolean }).configured)))
      .catch(() => setConfigured(false));
  }, []);
  async function list(key: string, cursor?: string) {
    const data = await api<{ images: ImageRecord[]; next: string | null }>(
      `/api/images${cursor ? `?before=${encodeURIComponent(cursor)}` : ''}`,
      key,
    );
    setImages((items) => (cursor ? [...items, ...data.images] : data.images));
    setNext(data.next);
  }
  useEffect(() => {
    void list(token).catch((e) => setError(e.message));
  }, [token]);
  useEffect(() => {
    sessionBusy(busy);
    return () => sessionBusy(false);
  }, [busy, sessionBusy]);
  async function upload(file?: File) {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      if (file.size > 8 * 1024 * 1024) throw Error('单张图片不能超过 8 MiB。');
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      const image = await api<ImageRecord>('/api/images', token, {
        method: 'POST',
        headers: { 'Content-Type': file.type, 'X-Filename': encodeURIComponent(file.name) },
        body: file,
      });
      setImages((items) => [image, ...items]);
    } catch (e) {
      setError(`上传失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  async function archive(item: ImageRecord) {
    setBusy(true);
    setError('');
    try {
      await api(`/api/images/${item.id}`, token, { method: 'DELETE' });
      setRemoved(item);
      setImages((items) => items.filter((i) => i.id !== item.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="图片管理"
        description="存放图片，也让分享变得简单。上传后即可复制直链或 Markdown。"
      >
        <span className="badge">
          <LockKeyhole size={13} />
          站主管理
        </span>
      </PageTitle>
      {configured === false && (
        <Notice>图片服务尚未就绪。绑定存储、数据库并配置管理员密钥后，即可启用上传。</Notice>
      )}
      <div className="editor-toolbar">
        <label className={`button primary file-button ${busy ? 'disabled' : ''}`}>
          <Upload size={16} />
          {busy ? '处理中…' : '上传图片'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            disabled={busy}
            aria-label="上传图片"
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        <span className="muted small-text">PNG / JPG / GIF / WebP · 单张 8 MiB</span>
      </div>
      <p className="privacy-note">
        上传的图片公开可访问。归档仅隐藏列表条目，已有链接仍可访问，文件仍占存储空间。
      </p>
      {removed && (
        <div className="undo-banner" role="status">
          <span>已归档「{removed.filename}」</span>
          <button
            className="button small"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/api/images/${removed.id}`, token, { method: 'POST' });
                setImages((items) => [removed, ...items]);
                setRemoved(null);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            撤销归档
          </button>
        </div>
      )}
      {!images.length ? (
        <div className="empty">
          <ImageIcon size={36} />
          <h2>这里还没有图片</h2>
          <p>用上方的“上传图片”，放入第一张图片。</p>
        </div>
      ) : (
        <div className="image-grid">
          {images.map((item) => (
            <article className="image-card" key={item.id}>
              <a href={item.url} target="_blank" rel="noreferrer">
                <img src={item.url} alt={item.filename} width={400} height={260} loading="lazy" />
              </a>
              <div>
                <h2>{item.filename}</h2>
                <p>
                  {(item.size / 1024).toFixed(1)} KB ·{' '}
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
                <input aria-label={`${item.filename} 的图片链接`} value={item.url} readOnly />
                <div className="image-actions">
                  <CopyButton text={item.url} label="直链" />
                  <CopyButton text={`![图片](${item.url})`} label="Markdown" />
                  <button
                    className="icon-button"
                    aria-label={`归档 ${item.filename}`}
                    disabled={busy}
                    onClick={() => void archive(item)}
                  >
                    <Archive size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {next && (
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await list(token, next);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          加载更多
        </button>
      )}
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
