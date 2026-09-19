import type { Node, Edge } from '@xyflow/react';

export type ToolKind = 'flow' | 'canvas';
export type Diagram = { nodes: Node[]; edges: Edge[] };
export type Point = { x: number; y: number };
export type Stroke = {
  kind: 'pen' | 'rect' | 'ellipse';
  color: string;
  width: number;
  points: Point[];
};
export type ToolContent = Diagram | Stroke[];
export const canvasColors = ['#2c503e', '#29312c', '#a94a35', '#375f99'];
export const toolNames: Record<ToolKind, string> = { flow: '流程图', canvas: '画布' };
export function emptyContent(kind: ToolKind): ToolContent {
  return kind === 'flow' ? { nodes: [], edges: [] } : [];
}
export function validDiagram(value: unknown): value is Diagram {
  if (!value || typeof value !== 'object') return false;
  const d = value as Diagram;
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
        n.id.length <= 200 &&
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
    d.edges.every(
      (e) =>
        e &&
        typeof e.id === 'string' &&
        e.id.length <= 200 &&
        ids.has(e.source) &&
        ids.has(e.target),
    ) &&
    new Set(d.edges.map((e) => e.id)).size === d.edges.length
  );
}
export function cleanDiagram(d: Diagram): Diagram {
  return {
    nodes: d.nodes.map(({ id, position, data, type }) => ({
      id,
      position: { x: position.x, y: position.y },
      data: { label: data.label },
      ...(type ? { type } : {}),
    })),
    edges: d.edges.map(({ id, source, target }) => ({ id, source, target })),
  };
}
export function validStrokes(value: unknown): value is Stroke[] {
  return (
    Array.isArray(value) &&
    value.length <= 2000 &&
    value.every(
      (s) =>
        s &&
        ['pen', 'rect', 'ellipse'].includes(s.kind) &&
        canvasColors.includes(s.color) &&
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
export function validContent(kind: ToolKind, value: unknown): value is ToolContent {
  return kind === 'flow' ? validDiagram(value) : validStrokes(value);
}
export type ToolDocumentSummary = {
  id: string;
  kind: ToolKind;
  title: string;
  revision: number;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
  archived_at: string | null;
};
export type ToolDocument = ToolDocumentSummary & { content: string };
export function documentURL(doc: Pick<ToolDocument, 'kind' | 'id'>) {
  return `/tools/${doc.kind}/${encodeURIComponent(doc.id)}`;
}
