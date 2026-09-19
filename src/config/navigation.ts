import { Braces, Workflow, PencilRuler } from 'lucide-react';

export const tools = [
  {
    to: '/tools/dev',
    label: '开发工具',
    icon: Braces,
    description: 'JSON、编码、时间戳与哈希',
    detail: '文本处理',
    shortcut: '{ }',
  },
  {
    to: '/tools/flow',
    label: '流程图',
    icon: Workflow,
    description: '拖拽节点、连接流程、导出 JSON',
    detail: '结构梳理',
    shortcut: '↗',
  },
  {
    to: '/tools/canvas',
    label: '自由画布',
    icon: PencilRuler,
    description: '手绘、形状、撤销重做与 PNG 导出',
    detail: '草图标注',
    shortcut: '✎',
  },
];
