import { useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Language } from '@remoteai/i18n';
import { isTauri } from '@tauri-apps/api/core';
import { BrowserContents } from '../provider-market/ProviderBrowser';
import { BrowserResourcesContext } from '../file-preview/workspace/browserResources';
import { NavigationBrowserHomeContext, NavigationBrowserSurface } from './NavigationBrowserSurface';
import { useNavigationBrowserHome, type BrowserHomeTransport } from './useNavigationBrowserHome';
import { BrowserNavigationContext } from './BrowserNavigationProvider';
import { useWebsiteTabs } from '../file-preview/workspace/useWebsiteTabs';
import { marketText } from '../provider-market/i18n';
import { useCompactBrowser } from './bookmarks/useCompactBrowser';
import './browserPage.css';
import { BrowserClientContext } from '../file-preview/workspace/browserClient';

/** Reuse the established engine and tabs without tying the main browser to a conversation. */
export function BrowserPage({ language, active = true, onClose, homeBaseUrl, homeTransport, sidebarToggle,
  tabBarHost, windowControls }: {
  language: Language; active?: boolean; onClose?: () => void; homeBaseUrl?: string;
  homeTransport?: BrowserHomeTransport; sidebarToggle?: ReactNode;
  tabBarHost?: HTMLElement | null; windowControls?: ReactNode;
}) {
  const navigation = useContext(BrowserNavigationContext);
  const standalone = useWebsiteTabs();
  const browser = navigation?.browser ?? standalone;
  const client = useContext(BrowserClientContext);
  const browserClient = browser.tabs.find(tab => tab.id === browser.activeId)?.automationClient ?? client;
  const [expanded, setExpanded] = useState(false);
  const host = useRef<HTMLElement>(null);
  const compact = useCompactBrowser() && !isTauri();
  const homeUrl = useNavigationBrowserHome(homeBaseUrl, active && !compact, homeTransport);
  useEffect(() => { if (!active) setExpanded(false); }, [active]);
  useLayoutEffect(() => {
    const element = host.current;
    if (!expanded || !compact || !active || !element) return;
    // The top layer fills the viewport without moving the retained page out of its transformed tab track.
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', escape);
    if (typeof element.showPopover === 'function') {
      element.setAttribute('popover', 'manual'); element.showPopover();
    }
    return () => {
      document.removeEventListener('keydown', escape);
      if (element.hasAttribute('popover')) { element.hidePopover(); element.removeAttribute('popover'); }
    };
  }, [active, compact, expanded]);
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (!browser.tabs.length) browser.onNewTab();
  }, [browser.onNewTab]);
  const closeTabs = (ids: string[]) => {
    browser.onCloseTabs(ids);
    if (browser.tabs.every(tab => ids.includes(tab.id))) browser.onNewTab();
  };
  return <BrowserResourcesContext.Provider value={browser.resources}>
    <NavigationBrowserHomeContext.Provider value={compact ? '' : homeUrl}>
    <section ref={host} hidden={!active} className={`pm-browser browser-main-page${expanded ? ' browser-main-expanded' : ''}`}
    aria-label={marketText(language)('market.browserNavigation')}>
    <BrowserClientContext.Provider value={browserClient}>
    <BrowserContents {...browser} embedded mainBrowser language={language} open={active} Surface={NavigationBrowserSurface}
      tabBarStart={sidebarToggle} tabBarHost={expanded ? null : tabBarHost} windowControls={windowControls}
      onCloseTab={id => closeTabs([id])} onCloseTabs={closeTabs}
      onClose={() => { setExpanded(false); onClose?.(); }}
      fullscreen={expanded} toggleFullscreen={() => setExpanded(value => !value)} />
    </BrowserClientContext.Provider>
  </section></NavigationBrowserHomeContext.Provider></BrowserResourcesContext.Provider>;
}
