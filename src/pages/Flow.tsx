import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Download, Upload, Trash2 } from 'lucide-react';
import { PageTitle, Notice, download } from '../components/ui';
import CloudSync from '../components/CloudSync';
import { useCloudDraft } from '../lib/cloudDraft';
import { readLocal, saveLocal } from '../lib/storage';
import { cleanDiagram, validDiagram, type Diagram } from '../lib/toolDocumentData';
import SaveDocument from '../components/documents/SaveDocument';
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
export default function Flow({
  file,
}: { file?: { initial: Diagram; onChange: (value: Diagram) => void } } = {}) {
  const [saved] = useState(() =>
    cleanDiagram(file?.initial ?? readLocal('studio-flow-v1', initial, validDiagram)),
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(saved.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(saved.edges);
  const [label, setLabel] = useState('新的步骤');
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [storageOK, setStorageOK] = useState(true);
  const latest = useRef({ nodes, edges });
  latest.current = { nodes, edges };
  const sync = useCloudDraft<Diagram>(
    'flow',
    latest.current,
    (d) => {
      setNodes(d.nodes);
      setEdges(d.edges);
      setSelected(null);
    },
    validDiagram,
    !file,
  );
  useEffect(
    () => () => {
      if (!file) saveLocal('studio-flow-v1', latest.current);
    },
    [],
  );
  useEffect(() => {
    if (file) {
      file.onChange(cleanDiagram({ nodes, edges }));
      return;
    }
    const timer = setTimeout(
      () => setStorageOK(saveLocal('studio-flow-v1', { nodes, edges })),
      350,
    );
    return () => clearTimeout(timer);
  }, [nodes, edges, file?.onChange]);
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
        <span className="badge">
          {file ? '云端文件' : sync.status === 'on' ? '本地 + 云端' : '本地草稿'}
        </span>
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
        {!file && (
          <>
            <SaveDocument kind="flow" content={cleanDiagram({ nodes, edges })} />
            <CloudSync sync={sync} />
          </>
        )}
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
          {file
            ? '当前文件独立保存'
            : storageOK
              ? '自动保存到当前浏览器'
              : '本地存储不可用，请导出备份'}{' '}
          · 选中后按 Delete 删除
        </span>
      </div>
      {message && <Notice>{message}</Notice>}
      {!storageOK && <Notice error>无法保存草稿，浏览器存储可能已满或被禁用。请导出备份。</Notice>}
    </>
  );
}
