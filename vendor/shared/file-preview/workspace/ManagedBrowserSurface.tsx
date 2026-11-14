import { useContext, useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Globe } from 'lucide-react';
import type { BrowserSurfaceProps } from '../../provider-market/ProviderBrowser';
import { ProviderBrowserSurface } from '../../browser/managed/ProviderBrowserSurface';
import { browserOverlayAttributes, hasBrowserOverlay } from '../../browser/managed/browserOverlays';
import { BrowserClientContext } from './browserClient';
import { placeBrowser } from './nativeBrowserPlacement';
import { nativeSurfaceSession } from '../../browser/managed/nativeSurfaceSession';
import { useNativeBrowserPreview } from '../../browser/managed/useNativeBrowserPreview';
import { BrowserInspector } from '../../browser/managed/BrowserInspector';
import { rememberWebsiteIcons } from '../../browser/icons/websiteIcons';

export function WebsiteBrowserSurface(props: BrowserSurfaceProps) {
  return props.tab.automationThread ? <ManagedBrowserSurface {...props} /> : <ProviderBrowserSurface {...props} />;
}

function ManagedBrowserSurface({ tab, active, onNavigate, onLoadingChange, t, obscured }: BrowserSurfaceProps) {
  const client = useContext(BrowserClientContext);
  const host = useRef<HTMLDivElement>(null);
  const current = useRef({ active, onNavigate, onLoadingChange, obscured });
  current.current = { active, onNavigate, onLoadingChange, obscured };
  const { image: overlayImage, preview } = useNativeBrowserPreview();
  const [image, setImage] = useState('');
  const [failed, setFailed] = useState(false);
  const refresh = useRef<() => void>();
  useEffect(() => {
    let disposed = false;
    let receivedLoading = false;
    const listener = client.subscribe(event => {
      if (!disposed && event.type === 'loading' && event.tabId === tab.id && event.threadId === tab.automationThread) {
        receivedLoading = true;
        current.current.onLoadingChange?.(event.loading);
      }
    });
    void client.request({ threadId: tab.automationThread!, command: { action: 'list' } })
      .then(reply => {
        const entry = reply.tabs?.find(entry => entry.id === tab.id);
        if (!disposed && entry) rememberWebsiteIcons(entry.url, entry.icons);
        if (!disposed && !receivedLoading) {
          current.current.onLoadingChange?.(Boolean(reply.tabs?.find(entry => entry.id === tab.id)?.loading));
        }
      })
      .catch(error => console.debug('Browser loading state unavailable', error));
    void listener.catch(error => console.debug('Browser loading subscription unavailable', error));
    return () => { disposed = true; void listener.then(stop => stop()).catch(() => {}); };
  }, [client, tab.id, tab.automationThread]);
  useEffect(() => {
    if (!client.native || !host.current) return;
    const element = host.current;
    let stopped = false;
    const session = nativeSurfaceSession<Parameters<typeof placeBrowser>[0] & { preservePreview: boolean }>({
      apply: async ({ preservePreview: _preview, ...request }) => {
        await placeBrowser(request);
        if (!stopped) setFailed(false);
      },
      capture: async () => {
        const reply = await client.request({ threadId: tab.automationThread!, tabId: tab.id,
          command: { action: 'screenshot' } });
        const image = reply.result?.image;
        if (!image) throw new Error('Browser preview unavailable');
        return `data:${image.mimeType};base64,${image.data}`;
      },
      preview, failed: () => { if (!stopped) setFailed(true); },
    });
    const sync = () => {
      const bounds = element.getBoundingClientRect();
      const modal = hasBrowserOverlay(element);
      const visible = current.current.active && !document.hidden && !modal && bounds.width > 0 && bounds.height > 0;
      session.update({ threadId: tab.automationThread, tabId: tab.id,
        visible, preservePreview: Boolean(current.current.obscured || modal),
        bounds: { x: Math.max(0, bounds.x), y: Math.max(0, bounds.y), width: bounds.width, height: bounds.height } });
    };
    refresh.current = sync;
    const observer = new ResizeObserver(sync); observer.observe(element);
    const overlays = new MutationObserver(sync);
    overlays.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: browserOverlayAttributes });
    window.addEventListener('resize', sync); window.addEventListener('scroll', sync, true);
    document.addEventListener('visibilitychange', sync);
    const listener = listen<{ url: string; popup?: boolean; icons?: string[] }>(
      `conversation-browser-${tab.id}`, ({ payload }) => {
      if (!payload.popup && payload.url) rememberWebsiteIcons(payload.url, payload.icons);
      if (!payload.popup && payload.url) current.current.onNavigate(payload.url);
    });
    void listener.catch(() => setFailed(true)); sync();
    return () => {
      stopped = true; refresh.current = undefined; observer.disconnect(); overlays.disconnect();
      window.removeEventListener('resize', sync); window.removeEventListener('scroll', sync, true);
      document.removeEventListener('visibilitychange', sync);
      void listener.then(stop => stop()).catch(() => {});
      // Preserve the model's tab when the user switches conversations; only release its screen placement.
      void session.close().then(() => placeBrowser({ threadId: tab.automationThread, tabId: tab.id,
        visible: false, bounds: { x: 0, y: 0, width: 1, height: 1 } }))
        .catch(error => console.debug('Browser preview already closed', error));
    };
  }, [client, tab.id, tab.automationThread, preview]);
  useEffect(() => { refresh.current?.(); }, [active, obscured]);
  useEffect(() => {
    if (client.native || !active || !tab.automationThread) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        const reply = await client.request({ threadId: tab.automationThread!, tabId: tab.id,
          command: { action: 'screenshot' } });
        if (stopped) return;
        const image = reply.result?.image;
        if (image) { setImage(`data:${image.mimeType};base64,${image.data}`); setFailed(false); }
        if (reply.result?.url) current.current.onNavigate(reply.result.url);
        if (reply.result?.url) rememberWebsiteIcons(reply.result.url, reply.result.icons);
        if (typeof reply.result?.loading === 'boolean') current.current.onLoadingChange?.(reply.result.loading);
      } catch { if (!stopped) setFailed(true); }
      finally { if (!stopped) timer = setTimeout(() => { void read(); }, 700); }
    };
    void read();
    return () => { stopped = true; clearTimeout(timer); };
  }, [client, tab.id, tab.automationThread, active]);
  return <BrowserInspector id={tab.id} kind="conversation" enabled={client.native} active={active && !obscured} t={t}>
    <div ref={host} className="pm-browser-surface">
    {client.native && overlayImage && !failed && <img className="native-browser-overlay-preview" src={overlayImage}
      alt="" aria-hidden draggable={false} />}
    {failed && <div className="pm-browser-feedback" role="status"><Globe size={32} /><p>{t('market.browserFailed')}</p></div>}
    {!client.native && image && !failed && <img className="website-browser-stream" src={image} alt={tab.title} />}
  </div></BrowserInspector>;
}
