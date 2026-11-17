import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { theme } from 'antd';
import { PanelRight, AppWindow, ExternalLink } from 'lucide-react';
import type { TerminalApi } from '../types';
import { useTerminalLinkActions } from './useTerminalLinkActions';
import styles from './terminal.module.less';

export interface TerminalLinkTarget { url: string; x: number; y: number }

export function TerminalLinkMenu({ target, id, api, close, translate: t }: {
  target: TerminalLinkTarget; id?: string; api: TerminalApi; close: () => void; translate: (source: string) => string;
}) {
  const { token } = theme.useToken();
  const host = useRef<HTMLDivElement>(null);
  const { open, busy, error, sidebar, standalone } = useTerminalLinkActions({
    url: target.url, id, api, close, translate: t,
  });
  useLayoutEffect(() => {
    const position = () => {
      const element = host.current;
      if (!element) return;
      const { width, height } = element.getBoundingClientRect();
      element.style.left = `${Math.max(8, Math.min(target.x, window.innerWidth - width - 8))}px`;
      element.style.top = `${Math.max(8, Math.min(target.y, window.innerHeight - height - 8))}px`;
    };
    position();
    const observer = new ResizeObserver(position);
    if (host.current) observer.observe(host.current);
    window.addEventListener('resize', position);
    return () => { observer.disconnect(); window.removeEventListener('resize', position); };
  }, [target.x, target.y]);
  useEffect(() => {
    host.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const outside = (event: PointerEvent) => { if (!host.current?.contains(event.target as Node)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true);
    };
  }, [close]);
  return createPortal(<div ref={host} className={styles.linkMenu} role="dialog" aria-modal="true"
    aria-label={t("client.terminal.openTerminalLink")}
    style={{ fontSize: token.fontSize, fontFamily: token.fontFamily, lineHeight: token.lineHeight,
      background: token.colorBgElevated, color: token.colorText, borderColor: token.colorBorder }}>
    <div className={styles.linkUrl}>{target.url}</div>
    <div className={styles.linkActions}>
      <button disabled={busy || !sidebar} onClick={() => { void open('sidebar'); }}>
        <PanelRight aria-hidden size="1.2em" />{t('client.terminal.openInSidebarBrowser')}</button>
      <button disabled={busy || !standalone} onClick={() => { void open('standalone'); }}>
        <AppWindow aria-hidden size="1.2em" />{t('client.terminal.openInStandaloneBrowser')}</button>
      <button disabled={busy} onClick={() => { void open('external'); }}>
        <ExternalLink aria-hidden size="1.2em" />{t('client.terminal.openInExternalBrowser')}</button>
    </div>
    {busy && <div role="status">{t("client.terminal.openingLink")}</div>}
    {error && <div role="alert">{error}</div>}
  </div>, document.body);
}
