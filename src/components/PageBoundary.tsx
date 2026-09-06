import { Component, type ReactNode } from 'react';
export default class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <section className="empty" role="alert">
          <h1>页面暂时没有打开</h1>
          <p>资源可能已更新，或网络连接中断。请刷新页面后重试。</p>
          <button className="button primary" onClick={() => window.location.reload()}>
            刷新页面
          </button>
        </section>
      );
    return this.props.children;
  }
}
