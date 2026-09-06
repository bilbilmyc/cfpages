import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Node,
  type Edge,
  type Connection,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Download, Upload, Trash2 } from 'lucide-react';
import { PageTitle, Notice, download } from '../components/ui';
import { readLocal, saveLocal } from '../lib/storage';
type Diagram = { nodes: Node[]; edges: Edge[] };
const initial: Diagram = {
  nodes: [
    { id: '1', position: { x: 220, y: 0 }, data: { label: '一个想法' }, type: 'input' },
    { id: '2', position: { x: 220, y: 120 }, data: { label: '动手试试看' } },
    { id: '3', position: { x: 80, y: 260 }, data: { label: '记录发现' }, type: 'output' },
    { id: '4', position: { x: 360, y: 260 }, data: { label: '继续打磨' }, type: 'output' },
  ],
  edges: [
    { id: 'e1', source: '1', target: '2' },
    { id: 'e2', source: '2', target: '3' },
    { id: 'e3', source: '2', target: '4' },
  ],
};
export function validDiagram(v: unknown): v is Diagram {
  if (!v || typeof v !== 'object') return false;
  const d = v as Diagram;
  if (
    !Array.isArray(d.nodes) ||
    !Array.isArray(d.edges) ||
    d.nodes.length > 500 ||
    d.edges.length > 2000
  )
    return false;
  if (
    !d.nodes.every(
      (n) =>
        n &&
        typeof n.id === 'string' &&
        typeof n.data?.label === 'string' &&
        n.data.label.length <= 200 &&
        Number.isFinite(n.position?.x) &&
        Number.isFinite(n.position?.y) &&
        (!n.type || ['input', 'output', 'default'].includes(n.type)),
    )
  )
    return false;
  const ids = new Set(d.nodes.map((n) => n.id));
  return (
    ids.size === d.nodes.length &&
    d.edges.every((e) => e && typeof e.id === 'string' && ids.has(e.source) && ids.has(e.target)) &&
    new Set(d.edges.map((e) => e.id)).size === d.edges.length
  );
}
function cleanDiagram(d: Diagram): Diagram {
  return {
    nodes: d.nodes.map(({ id, position, data, type }) => ({
      id,
      position: { x: position.x, y: position.y },
      data: { label: data.label },
      type,
    })),
    edges: d.edges.map(({ id, source, target }) => ({ id, source, target })),
  };
}
export default function Flow() {
  const [saved] = useState(() => cleanDiagram(readLocal('studio-flow-v1', initial, validDiagram)));
  const [nodes, setNodes, onNodesChange] = useNodesState(saved.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(saved.edges);
  const [label, setLabel] = useState('新的步骤');
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [storageOK, setStorageOK] = useState(true);
  const latest = useRef({ nodes, edges });
  latest.current = { nodes, edges };
  useEffect(
    () => () => {
      saveLocal('studio-flow-v1', latest.current);
    },
    [],
  );
  useEffect(() => {
    const timer = setTimeout(
      () => setStorageOK(saveLocal('studio-flow-v1', { nodes, edges })),
      350,
    );
    return () => clearTimeout(timer);
  }, [nodes, edges]);
  const connect = useCallback(
    (connection: Connection) => setEdges((e) => (e.length < 2000 ? addEdge(connection, e) : e)),
    [setEdges],
  );
  const add = () => {
    if (nodes.length >= 500) {
      setMessage('最多支持 500 个节点，请拆分成多个流程。');
      return;
    }
    const id = crypto.randomUUID();
    setNodes((n) => [
      ...n,
      {
        id,
        position: { x: 200 + (n.length % 4) * 40, y: 80 + n.length * 25 },
        data: { label: label.trim() || '新的步骤' },
      },
    ]);
  };
  async function load(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw Error('文件不能超过 2 MiB');
      const d: unknown = JSON.parse(await file.text());
      if (!validDiagram(d)) throw Error('不是有效的流程图文件');
      const clean = cleanDiagram(d);
      setNodes(clean.nodes);
      setEdges(clean.edges);
      setSelected(null);
      setMessage('已导入。当前草稿已替换。');
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle
        title="流程图"
        description="把想法展开，让每一步都清楚。拖动节点，从连接点拉出一条线。"
      >
        <span className="badge">本地草稿</span>
      </PageTitle>
      <div className="editor-toolbar">
        <label className="inline-field">
          节点文字
          <input value={label} maxLength={200} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <button className="button primary" onClick={add}>
          <Plus size={16} />
          添加节点
        </button>
        <button
          className="button"
          disabled={!selected}
          onClick={() =>
            setNodes((n) =>
              n.map((node) =>
                node.id === selected
                  ? { ...node, data: { label: label.trim() || '新的步骤' } }
                  : node,
              ),
            )
          }
        >
          更新选中
        </button>
        <div className="toolbar-spacer" />
        <button
          className="button"
          onClick={() => download(JSON.stringify({ nodes, edges }, null, 2), 'flow.json')}
        >
          <Download size={16} />
          导出
        </button>
        <label className="button file-button">
          <Upload size={16} />
          导入
          <input
            aria-label="导入流程图"
            type="file"
            accept=".json"
            onChange={(e) => {
              void load(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        <button
          className="button"
          disabled={!nodes.some((n) => n.selected) && !edges.some((e) => e.selected)}
          onClick={() => {
            const ids = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
            setNodes((n) => n.filter((n) => !n.selected));
            setEdges((e) =>
              e.filter((e) => !e.selected && !ids.has(e.source) && !ids.has(e.target)),
            );
            setSelected(null);
          }}
        >
          <Trash2 size={16} />
          删除选中
        </button>
      </div>
      <div className="flow-editor">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={connect}
          onNodeClick={(_, n) => {
            setSelected(n.id);
            setLabel(String(n.data.label));
          }}
          onPaneClick={() => setSelected(null)}
          fitView
          defaultEdgeOptions={{ type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }}
        >
          <Background gap={24} size={1} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
      <div className="editor-foot">
        <span>
          {nodes.length} 个节点 · {edges.length} 条连线
        </span>
        <span>
          {storageOK ? '自动保存到当前浏览器' : '本地存储不可用，请导出备份'} · 选中后按 Delete 删除
        </span>
      </div>
      {message && <Notice>{message}</Notice>}
      {!storageOK && <Notice error>无法保存草稿，浏览器存储可能已满或被禁用。请导出备份。</Notice>}
    </>
  );
}
