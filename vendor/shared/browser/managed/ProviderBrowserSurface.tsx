import { useEffect, useRef, useState } from 'react';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Globe } from 'lucide-react';
import { useDesktopLayout } from '../../layout/useDesktopLayout';
import { uiText } from '../../localization/uiText';
import { pageUrl } from '../../provider-market/pageLink';
import type { BrowserSurfaceProps } from '../../provider-market/ProviderBrowser';
import type { BrowserPageTitle } from '../../provider-market/browserState';
import { nativeBrowserSession } from './providerBrowserSession';
import { browserMappings } from '../../port-mapping/browserMappings';
import { nativeSurfaceBounds, type NativePageFullscreenEvent } from './nativeSurfaceSession';
import { browserOverlayAttributes, hasBrowserOverlay } from './browserOverlays';
import { BrowserFrame } from './BrowserFrame';
import { useNativeZoom, type NativeZoomEvent } from '../zoom/nativeZoom';
import { useNativeBrowserPreview } from './useNativeBrowserPreview';
import { BrowserInspector } from './BrowserInspector';
import { rememberWebsiteIcons } from '../icons/websiteIcons';

function browserFeedback(state: { url: string; unsupported: boolean; needsDesktop: boolean; failed: boolean }) {
  if (!state.url) return 'market.browserBlank';
  if (state.unsupported) return 'market.browserHeadersUnsupported';
  if (state.needsDesktop) return 'market.browserHeadersDesktop';
  if (state.failed) return 'market.browserFailed';
  return null;
}

export function ProviderBrowserSurface(props: BrowserSurfaceProps) {
  const { tab, active, command, onNavigate, onPopup, onLoadingChange, t, hideForModal, obscured } = props;
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pageFullscreen, setPageFullscreen] = useState(false);
  const desktop = isTauri();
  const wide = useDesktopLayout();
  const address = !desktop && wide ? pageUrl(tab.url) : null;
  // A browser never exposes a cross-origin iframe's TLS failure to its parent. A top-level
  // navigation lets the browser present its own certificate prompt for the same address.
  const openHttps = address?.protocol === 'https:' && <a href={address.href}
    target="_blank" rel="noopener noreferrer">{uiText('client.workspaceActions.openInBrowser')}</a>;
  const { image, preview } = useNativeBrowserPreview();
  const latest = { tab, active, pageFullscreen, onNavigate, onPopup, onLoadingChange, obscured,
    onVisit: props.onVisit, onPageTitle: props.onPageTitle };
  const state = useRef(latest);
  state.current = latest;
  const refresh = useRef<() => void>();
  const nativeNavigation = useRef('');
  const lastCommand = useRef(0);
  const needsDesktop = !desktop && Object.keys(tab.headers).length > 0;
  const zoom = useNativeZoom('provider', desktop && !!tab.url && !failed && !unsupported);
  useEffect(() => {
    if (!desktop || !host.current) return;
    const element = host.current;
    const session = nativeBrowserSession(tab.id, (reason) => {
      setUnsupported(String(reason).includes('market.browserHeadersUnsupported')); setFailed(true);
      state.current.onLoadingChange?.(false);
    }, preview);
    let frame = 0;
    let modalVisible = false;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = state.current;
        const bounds = element.getBoundingClientRect();
        const visible = current.active && !modalVisible && !document.hidden && bounds.width > 0 && bounds.height > 0;
        if (!current.tab.url) return;
        session.update({ url: current.tab.url, headers: current.tab.headers,
          headerOrigin: current.tab.headerOrigin, visible, preservePreview: current.obscured || modalVisible,
          navigate: nativeNavigation.current !== current.tab.url,
          bounds: nativeSurfaceBounds(bounds, current.pageFullscreen && visible) });
      });
    };
    refresh.current = sync;
    const stopMappings = browserMappings.subscribe(sync);
    const unlisten = listen<{ url?: string; title?: string; popup?: boolean; loading?: boolean;
      visited?: boolean; icons?: string[]; pageTitle?: BrowserPageTitle } & NativeZoomEvent & NativePageFullscreenEvent>(
      `provider-browser-${tab.id}`, ({ payload }) => {
        zoom?.(payload);
        if (typeof payload.pageFullscreen === 'boolean') setPageFullscreen(payload.pageFullscreen);
        if (payload.popup && payload.url) { state.current.onPopup(payload.url); return; }
        if (typeof payload.loading === 'boolean') state.current.onLoadingChange?.(payload.loading);
        if (payload.pageTitle) state.current.onPageTitle?.(payload.pageTitle);
        if (payload.visited && payload.url) {
          const page = { url: payload.url, title: payload.title ?? '' };
          state.current.onVisit?.(page);
          state.current.onPageTitle?.(page);
        }
        if (!payload.url) return;
        rememberWebsiteIcons(payload.url, payload.icons);
        nativeNavigation.current = payload.url;
        state.current.onNavigate(payload.url);
      });
    void unlisten.catch(() => setFailed(true));
    const observer = new ResizeObserver(sync); observer.observe(element);
    // A centered phone viewport can move without changing its own width.
    if (element.parentElement) observer.observe(element.parentElement);
    const checkModal = () => {
      const visible = hasBrowserOverlay(element, Boolean(hideForModal));
      if (visible !== modalVisible) { modalVisible = visible; sync(); }
    };
    const overlays = new MutationObserver(checkModal);
    overlays.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: browserOverlayAttributes });
    checkModal();
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    document.addEventListener('animationend', sync, true);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      stopMappings(); refresh.current = undefined; cancelAnimationFrame(frame); observer.disconnect(); overlays.disconnect();
      window.removeEventListener('resize', sync); document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('scroll', sync, true); document.removeEventListener('animationend', sync, true);
      // Listener registration failure is already surfaced above; cleanup has nothing to remove then.
      void unlisten.then((stop) => stop()).catch(() => {});
      void session.close().catch((error) => console.error('Provider browser close failed', error));
    };
  }, [desktop, tab.id, attempt, hideForModal, preview]);
  useEffect(() => { refresh.current?.(); }, [active, tab.url, obscured, pageFullscreen]);
  useEffect(() => {
    if (!command || command.sequence === lastCommand.current) return;
    lastCommand.current = command.sequence;
    if (!desktop) {
      if (command.action === 'reload' && failed) { setFailed(false); setAttempt(value => value + 1); }
      return;
    }
    void invoke('provider_browser_action', { id: tab.id, action: command.action })
      .catch(() => { state.current.onLoadingChange?.(false); setFailed(true); });
  }, [command, desktop, tab.id]);
  const feedback = browserFeedback({ url: tab.url, unsupported, needsDesktop, failed });
  return <BrowserInspector id={tab.id} kind="provider" enabled={desktop} active={active && !obscured}
    pageFullscreen={pageFullscreen} t={t}>
    <div className="pm-browser-surface" ref={host}>
    {desktop && image && !feedback && <img className="native-browser-overlay-preview" src={image}
      alt="" aria-hidden draggable={false} />}
    {feedback && <div className="pm-browser-feedback" role="status"><Globe size={32} /><p>{t(feedback)}</p>
      {failed && openHttps}
      {failed && <button onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>
        {t('market.retry')}</button>}</div>}
    {!feedback && !desktop && <BrowserFrame {...props} key={attempt} onError={() => setFailed(true)} />}
    {!desktop && !feedback && <div className="pm-browser-web-notice">{t('market.browserWebNotice')} {openHttps}</div>}
  </div></BrowserInspector>;
}
