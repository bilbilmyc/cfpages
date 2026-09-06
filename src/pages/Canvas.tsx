import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Download, Undo2, Redo2, Pencil, Square, Circle, Trash2 } from 'lucide-react';
import { PageTitle, Notice } from '../components/ui';
import { readLocal, saveLocal } from '../lib/storage';
type Point = { x: number; y: number };
type Stroke = { kind: 'pen' | 'rect' | 'ellipse'; color: string; width: number; points: Point[] };
const colors = ['#2c503e', '#29312c', '#a94a35', '#375f99'];
function validStrokes(v: unknown): v is Stroke[] {
  return (
    Array.isArray(v) &&
    v.length <= 2000 &&
    v.every(
      (s) =>
        s &&
        ['pen', 'rect', 'ellipse'].includes(s.kind) &&
        colors.includes(s.color) &&
        [2, 4, 8].includes(s.width) &&
        Array.isArray(s.points) &&
        s.points.length <= 10000 &&
        s.points.every(
          (p: Point) =>
            p &&
            Number.isFinite(p.x) &&
            Number.isFinite(p.y) &&
            p.x >= 0 &&
            p.x <= 1200 &&
            p.y >= 0 &&
            p.y <= 720,
        ),
    )
  );
}
function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.clearRect(0, 0, 1200, 720);
  ctx.fillStyle = '#fbfcf8';
  ctx.fillRect(0, 0, 1200, 720);
  for (const s of strokes) {
    if (!s.points.length) continue;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const a = s.points[0],
      b = s.points.at(-1)!;
    ctx.beginPath();
    if (s.kind === 'rect') ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
    else if (s.kind === 'ellipse')
      ctx.ellipse(
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
        Math.abs(b.x - a.x) / 2,
        Math.abs(b.y - a.y) / 2,
        0,
        0,
        Math.PI * 2,
      );
    else if (s.points.length === 1) {
      ctx.arc(a.x, a.y, s.width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      s.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    }
    ctx.stroke();
  }
}
export default function Canvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const active = useRef<Stroke | null>(null);
  const [strokes, setStrokes] = useState(() =>
    readLocal('studio-canvas-v1', [] as Stroke[], validStrokes),
  );
  const [redo, setRedo] = useState<Stroke[][]>([]);
  const [undo, setUndo] = useState<Stroke[][]>([]);
  const [kind, setKind] = useState<Stroke['kind']>('pen');
  const [color, setColor] = useState(colors[0]);
  const [width, setWidth] = useState(4);
  const [ok, setOK] = useState(true);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) paint(ctx, strokes);
    setOK(saveLocal('studio-canvas-v1', strokes));
  }, [strokes]);
  const point = (e: PointerEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1200, ((e.clientX - r.left) * 1200) / r.width)),
      y: Math.max(0, Math.min(720, ((e.clientY - r.top) * 720) / r.height)),
    };
  };
  const commit = (next: Stroke[]) => {
    setUndo((h) => [...h.slice(-29), strokes]);
    setStrokes(next);
    setRedo([]);
  };
  const end = () => {
    if (active.current) {
      commit([...strokes, active.current]);
      active.current = null;
    }
  };
  return (
    <>
      <PageTitle title="自由画布" description="不必想得很完整，先画下来。支持鼠标、触控和触控笔。">
        <span className="badge">本地草稿</span>
      </PageTitle>
      <div className="editor-toolbar">
        <div className="tabs">
          {(
            [
              { id: 'pen', label: '画笔', icon: Pencil },
              { id: 'rect', label: '矩形', icon: Square },
              { id: 'ellipse', label: '椭圆', icon: Circle },
            ] as const
          ).map((t) => (
            <button key={t.id} aria-pressed={kind === t.id} onClick={() => setKind(t.id)}>
              <t.icon size={17} />
              {t.label}
            </button>
          ))}
        </div>
        <div className="swatches" aria-label="画笔颜色">
          {colors.map((c, i) => (
            <button
              key={c}
              className={`swatch swatch-${i}`}
              aria-label={['森林绿', '墨黑', '砖红', '蓝色'][i]}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <label className="inline-field">
          粗细
          <select value={width} onChange={(e) => setWidth(Number(e.target.value))}>
            <option value={2}>细</option>
            <option value={4}>中</option>
            <option value={8}>粗</option>
          </select>
        </label>
        <div className="toolbar-spacer" />
        <button
          className="button"
          disabled={!undo.length}
          onClick={() => {
            setRedo((r) => [...r, strokes]);
            setStrokes(undo.at(-1)!);
            setUndo((u) => u.slice(0, -1));
          }}
        >
          <Undo2 size={16} />
          撤销
        </button>
        <button
          className="button"
          disabled={!redo.length}
          onClick={() => {
            setUndo((u) => [...u, strokes]);
            setStrokes(redo.at(-1)!);
            setRedo((r) => r.slice(0, -1));
          }}
        >
          <Redo2 size={16} />
          重做
        </button>
        <button className="button" disabled={!strokes.length} onClick={() => commit([])}>
          <Trash2 size={16} />
          清空
        </button>
        <button
          className="button primary"
          onClick={() => {
            const a = document.createElement('a');
            a.href = ref.current!.toDataURL('image/png');
            a.download = 'canvas.png';
            a.click();
          }}
        >
          <Download size={16} />
          导出 PNG
        </button>
      </div>
      <div className="canvas-wrap">
        <canvas
          ref={ref}
          width={1200}
          height={720}
          aria-label="绘图画布，使用画笔或形状工具拖动绘制"
          onPointerDown={(e) => {
            if (e.button !== 0 || active.current || strokes.length >= 2000) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            active.current = { kind, color, width, points: [point(e)] };
          }}
          onPointerMove={(e) => {
            if (!active.current) return;
            const s = active.current;
            if (s.kind === 'pen') {
              if (s.points.length < 10000) s.points.push(point(e));
            } else s.points = [s.points[0], point(e)];
            const ctx = ref.current?.getContext('2d');
            if (ctx) paint(ctx, [...strokes, s]);
          }}
          onPointerUp={end}
          onPointerCancel={end}
          onLostPointerCapture={end}
        />
      </div>
      <div className="editor-foot">
        <span>1200 × 720 · {strokes.length} 笔</span>
        <span>草稿自动保存 · 清空可撤销 · 最多 2000 笔</span>
      </div>
      {!ok && <Notice error>无法保存到浏览器，请导出 PNG 备份。</Notice>}
    </>
  );
}
