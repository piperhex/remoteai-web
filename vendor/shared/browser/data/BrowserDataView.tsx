import { useId, type ReactNode } from 'react';
import { Modal, theme } from 'antd';

// Tab content is painted in the host, so its dialogs can use the same window.
export const browserDataTabContainer = () => document.body;

export function BrowserDataView({ title, close, children }: {
  title: string; close?: () => void; children: ReactNode;
}) {
  const heading = useId();
  const { token } = theme.useToken();
  if (close) return <Modal open title={title} onCancel={close} footer={null} width={640}
    zIndex={1800} className="browser-data-modal browser-chrome">{children}</Modal>;
  return <section className="browser-data-page" aria-labelledby={heading}
    style={{ fontFamily: token.fontFamily, fontSize: token.fontSize, lineHeight: token.lineHeight }}>
    <div className="browser-data-page-content">
      <h2 id={heading} style={{ fontSize: token.fontSizeHeading5, lineHeight: token.lineHeightHeading5 }}>{title}</h2>
      {children}
    </div>
  </section>;
}
