import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { BrowserTabCanvas } from './zoom/BrowserTabCanvas';
import { Globe, X } from 'lucide-react';
import type { BrowserWindowProps } from '../provider-market/ProviderBrowser';
import type { MarketText } from '../provider-market/i18n';
import { BrowserWebsiteIcon } from './icons/BrowserWebsiteIcon';
import { BrowserEdgeGestures } from './BrowserEdgeGestures';
import { SwipeableBrowserPage } from './SwipeableBrowserPage';
import { DESKTOP_SITE_WIDTH } from './siteMode';
import './mobileBrowser.css';
import { BrowserHome } from './BrowserHome';
import { useMobileBrowserRenderers } from './useMobileBrowserRenderers';

/** Keep tab cards and navigation available when an older mobile page releases its renderer. */
export function BrowserPages({ browser, t, manager, compact, query, blocked, select, loadingChanged, desktopTabs,
  home, bookmarks, recordVisit, zoomAnchor }: {
  zoomAnchor: HTMLSpanElement | null;
  browser: BrowserWindowProps & { embedded?: boolean; onPageNavigate?: (id: string, url: string) => void };
  t: MarketText; manager: boolean; compact: boolean; query: string; blocked: boolean;
  select: (id: string) => void; loadingChanged: (id: string, loading: boolean) => void;
  desktopTabs: Readonly<Record<string, boolean>>;
  home: (id: string) => boolean; bookmarks: () => void;
  recordVisit?: (id: string, page: { url: string; title: string }) => void;
}) {
  const { tabs, activeId, Surface, commands, open } = browser;
  const { resident } = useMobileBrowserRenderers(activeId, compact && open);
  const observed = useRef(new Map<string, { requested: string; url: string }>());
  useEffect(() => {
    // Save readable in-frame navigations upon eviction. Updating a live iframe's src would reload its document.
    for (const [id, visit] of observed.current) {
      const tab = tabs.find(entry => entry.id === id);
      if (!compact || tab?.url !== visit.requested) observed.current.delete(id);
      else if (!resident.includes(id)) {
        observed.current.delete(id);
        (browser.onPageNavigate ?? browser.onNavigate)(id, visit.url);
      }
    }
  }, [tabs, compact, resident, browser.onPageNavigate, browser.onNavigate]);
  const host = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 390, height: 650 });
  useLayoutEffect(() => {
    if (manager || !open || !host.current) return;
    const element = host.current;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width && height) setViewport({ width, height });
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, [manager, open]);
  const match = (title: string, url: string) => `${title} ${url}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  const previewStyle = { '--browser-preview-width': `${viewport.width}px`,
    '--browser-desktop-width': `${DESKTOP_SITE_WIDTH}px`,
    '--browser-desktop-scale': Math.min(1, viewport.width / DESKTOP_SITE_WIDTH),
    '--browser-preview-height': `${viewport.height}px`,
    '--browser-preview-scale': Math.max(0.1, (viewport.width - 48) / 2 / viewport.width) } as CSSProperties;
  return <div ref={host} className={`pm-browser-pages${manager ? ' browser-tab-grid' : ''}`} style={previewStyle}>
    {tabs.map(entry => {
      const title = entry.title || entry.url || t('market.browserNewTab');
      const mounted = !compact || resident.includes(entry.id);
      return <SwipeableBrowserPage key={entry.id} id={`page-${entry.id}`} role={manager ? 'group' : 'tabpanel'}
        enabled={manager} dismiss={() => browser.onCloseTab(entry.id)}
        className={`pm-browser-page${entry.id === activeId ? ' browser-tab-selected' : ''}`
          + (compact && desktopTabs[entry.id] ? ' browser-site-desktop' : '')}
        hidden={manager ? !match(title, entry.url) : entry.id !== activeId}>
        {manager && <div className="browser-tab-card-header"><BrowserWebsiteIcon url={entry.url} size={16} />
          <span>{title}</span><button aria-label={t('market.browserCloseTab', { name: title })}
            onClick={() => browser.onCloseTab(entry.id)}><X size={18} /></button></div>}
        <BrowserTabCanvas key="surface" id={entry.id} language={browser.language} desktop={!compact}
          anchor={!compact && open && entry.id === activeId && !blocked ? zoomAnchor : null}
          manager={manager} covered={home(entry.id)}>
          {mounted && <Surface tab={entry}
            active={open && entry.id === activeId && !blocked && !manager && !home(entry.id)}
            command={commands[entry.id] ?? null} hideForModal={browser.embedded} obscured={blocked}
            onNavigate={url => (browser.onPageNavigate ?? browser.onNavigate)(entry.id, url)}
            onPopup={url => browser.onPopup(entry.id, url)}
            onVisit={page => {
              if (compact && page.url !== entry.url && /^https?:\/\//i.test(page.url)) {
                observed.current.set(entry.id, { requested: entry.url, url: page.url });
              } else observed.current.delete(entry.id);
              recordVisit?.(entry.id, page);
            }}
            onLoadingChange={loading => loadingChanged(entry.id, loading)} t={t} />}
          {!mounted && manager && !home(entry.id) && <div className="pm-browser-feedback" aria-hidden>
            <Globe size={64} />
          </div>}
        </BrowserTabCanvas>
        {home(entry.id) && <BrowserHome t={t} visit={url => browser.onNavigate(entry.id, url)} bookmarks={bookmarks} />}
        {manager && <><button className="browser-tab-select" aria-label={title} aria-pressed={entry.id === activeId}
          onClick={() => select(entry.id)} /><span className="browser-tab-card-url">{entry.url || title}</span></>}
      </SwipeableBrowserPage>;
    })}
    {manager && !tabs.some(entry => match(entry.title || t('market.browserNewTab'), entry.url))
      && <p className="browser-tab-empty">{t('market.browserNoMatchingTabs')}</p>}
    {compact && !manager && !blocked && <BrowserEdgeGestures action={action => browser.onAction(activeId, action)} />}
  </div>;
}
