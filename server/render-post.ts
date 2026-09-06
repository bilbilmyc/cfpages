import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import ReactMarkdown from 'react-markdown';
// Render only while publishing. Public article requests reuse this safe HTML snapshot.
export function renderPost(body: string) {
  return renderToStaticMarkup(createElement(ReactMarkdown, { children: body }));
}
