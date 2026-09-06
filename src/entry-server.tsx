import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from './App';
import { site } from './config';

export const pages = [
  { path: '/', title: site.name, description: '记录技术、分享思考与打磨小工具的个人空间。' },
  {
    path: '/journal',
    title: `文章与分享 · ${site.name}`,
    description: '技术笔记、日常记录与思考。',
  },
  {
    path: '/about',
    title: `关于 · ${site.name}`,
    description: '关于这个个人空间，以及内容与隐私说明。',
  },
];
export function render(path: string) {
  return renderToString(
    <StaticRouter location={path}>
      <App />
    </StaticRouter>,
  );
}
