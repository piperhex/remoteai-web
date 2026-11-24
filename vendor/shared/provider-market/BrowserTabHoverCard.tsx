import { useContext, useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { theme } from 'antd';
import { Gauge } from 'lucide-react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { localeForLanguage, type Language } from '@remoteai/i18n';
import { useBrowserOverlay } from '../browser/overlays/BrowserOverlayProvider';
import { BrowserClientContext } from '../file-preview/workspace/browserClient';
import { pageUrl } from './pageLink';
import type { BrowserTab } from './browserState';
import type { MarketText } from './i18n';
import './browserTabHover.css';

export type BrowserTabVisit = { requested: string; url: string; title: string };

function memoryLabel(bytes: number | null | undefined, language: Language, t: MarketText) {
  if (bytes === null) return t('market.browserTabMemoryUnavailable');
  if (bytes === undefined) return t('market.browserTabMemory', { usage: '…' });
  const megabytes = bytes / 1_000_000;
  const usage = new Intl.NumberFormat(localeForLanguage(language), {
    style: 'unit', unit: 'megabyte', maximumFractionDigits: megabytes < 10 ? 1 : 0,
  }).format(megabytes);
  return t('market.browserTabMemory', { usage: `${usage} (JavaScript)` });
}

export function BrowserTabHoverCard({ anchor, tab, visit, language, t, stay, leave }: {
  anchor: HTMLElement; tab: BrowserTab; visit?: BrowserTabVisit; language: Language; t: MarketText;
  stay: () => void; leave: () => void;
}) {
  const overlay = useBrowserOverlay();
  const { token } = theme.useToken();
  const client = useContext(BrowserClientContext);
  const localRenderer = !tab.automationThread || (tab.automationClient ?? client).native;
  const measurable = localRenderer && isTauri() && Boolean(pageUrl(tab.url));
  const [bytes, setBytes] = useState<number | null>();
  useEffect(() => {
    if (!measurable) return;
    let current = true;
    const kind = tab.automationThread ? 'conversation' : 'provider';
    void invoke<number | null>('browser_tab_memory', { id: tab.id, kind })
      .then(value => { if (current) setBytes(value); })
      .catch(() => { if (current) setBytes(null); });
    return () => { current = false; };
  }, [tab.id, tab.url, tab.automationThread, measurable]);
  const page = visit && (visit.requested === tab.url || visit.url === tab.url) ? visit : tab;
  const site = pageUrl(page.url)?.host;
  const bounds = anchor.getBoundingClientRect();
  return createPortal(<div role="tooltip" id={`tab-hover-${tab.id}`} data-browser-popup="tab-hover"
    className="pm-tab-hover-card" onPointerEnter={stay} onPointerLeave={leave} style={{
      '--tab-left': `${bounds.left}px`, top: bounds.bottom, fontSize: token.fontSize, fontFamily: token.fontFamily,
      color: token.colorText, background: token.colorBgElevated, borderColor: token.colorBorderSecondary,
      boxShadow: token.boxShadowSecondary,
    } as CSSProperties}>
    <div className="pm-tab-hover-heading"><strong>{page.title || tab.title || site || t('market.browserNewTab')}</strong>
      {site && <span style={{ color: token.colorTextSecondary }}>{site}</span>}</div>
    {site && <div className="pm-tab-hover-memory" style={{ background: token.colorFillQuaternary,
      color: token.colorTextSecondary }}><Gauge aria-hidden size="1.2em" />
      {memoryLabel(measurable ? bytes : null, language, t)}</div>}
  </div>, overlay ?? document.body);
}
