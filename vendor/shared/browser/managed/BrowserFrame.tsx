import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { BrowserSurfaceProps } from '../../provider-market/ProviderBrowser';
import { readPageIcons } from '../icons/pageIcons';
import { rememberWebsiteIcons } from '../icons/websiteIcons';
import { WebsiteDownloadsContext } from '../downloads/context';
import { observeFrameDownloads } from '../downloads/frameDownloads';

/** Browser-hosted previews cannot retain a cross-origin document when cancelling its navigation. */
export function BrowserFrame({ tab, active, command, onLoadingChange, onVisit, onPageTitle, t, onError }:
  BrowserSurfaceProps & { onError: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const titleObserver = useRef<MutationObserver>();
  const downloads = useContext(WebsiteDownloadsContext);
  const current = useRef({ onLoadingChange, downloads, active }); current.current = { onLoadingChange, downloads, active };
  const stopObserving = useRef<() => void>();
  const observeDownloads = useCallback(() => {
    stopObserving.current?.();
    stopObserving.current = current.current.downloads ? observeFrameDownloads(frame.current, (url, name) => {
      current.current.downloads?.enqueue(url, name);
    }, () => Boolean(current.current.downloads && current.current.active)) : undefined;
  }, []);
  const lastCommand = useRef(command?.sequence ?? 0);
  const [attempt, setAttempt] = useState(0);
  const managed = Boolean(downloads);
  useEffect(() => {
    observeDownloads();
    return () => stopObserving.current?.();
  }, [managed, observeDownloads]);
  useEffect(() => {
    current.current.onLoadingChange?.(true);
    return () => { titleObserver.current?.disconnect(); current.current.onLoadingChange?.(false); };
  }, [tab.url, attempt]);
  useEffect(() => {
    if (!command || command.sequence === lastCommand.current) return;
    lastCommand.current = command.sequence;
    if (command.action !== 'stop') { setAttempt(value => value + 1); return; }
    try { frame.current?.contentWindow?.stop(); }
    catch {
      // The browser blocks cross-origin window.stop(). Blank this frame to cancel its requests;
      // the address and tab remain available for a subsequent reload.
      if (frame.current) frame.current.src = 'about:blank';
    }
    current.current.onLoadingChange?.(false);
  }, [command]);
  return <iframe ref={frame} key={attempt} src={tab.url} title={tab.title || t('market.browserNewTab')}
    allow="microphone; camera; geolocation; fullscreen"
    sandbox={`allow-scripts allow-forms allow-same-origin${managed ? ' allow-downloads' : ''}`}
    referrerPolicy="no-referrer"
    onLoad={() => {
      current.current.onLoadingChange?.(false);
      observeDownloads();
      titleObserver.current?.disconnect();
      try {
        const page = frame.current?.contentWindow;
        if (!page || page.location.href === 'about:blank') return;
        const doc = page.document;
        const reportTitle = () => onPageTitle?.({ url: doc.URL, title: doc.title }, tab.url);
        reportTitle();
        titleObserver.current = new MutationObserver(reportTitle);
        titleObserver.current.observe(doc.head ?? doc.documentElement,
          { subtree: true, childList: true, characterData: true });
        rememberWebsiteIcons(doc.URL, readPageIcons(doc));
        onVisit?.({ url: doc.URL, title: doc.title });
      } catch {
        onPageTitle?.({ url: tab.url, title: '' });
        onVisit?.({ url: tab.url, title: tab.title });
      }
    }} onError={() => {
      current.current.onLoadingChange?.(false); onError();
    }} />;
}
