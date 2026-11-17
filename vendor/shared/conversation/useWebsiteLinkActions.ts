import { useContext, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { BrowserNavigationContext } from '../browser/BrowserNavigationProvider';
import { copyText } from '../clipboard';
import { uiText } from '../localization/uiText';
import { websiteUrl } from '../terminal/links';
import { DetailsContext } from './detailsContext';
import { FileEnvironmentContext } from './fileEnvironment';

type Destination = 'sidebar' | 'standalone' | 'external';

export function useWebsiteLinkActions(href: string) {
  const sidebar = useContext(DetailsContext);
  const standalone = useContext(BrowserNavigationContext);
  const environment = useContext(FileEnvironmentContext);
  const pending = useRef(false);
  const alive = useRef(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const open = async (destination: Destination) => {
    if (pending.current) return;
    if (destination === 'sidebar' && !sidebar || destination === 'standalone' && !standalone) return;
    pending.current = true; setBusy(true);
    try {
      const url = environment ? await environment.resolveWebsite(href) : href;
      if (!alive.current) return;
      if (!websiteUrl(url)) throw new Error('Invalid website destination');
      // Resolve in the conversation's computer context once, before changing browser destinations.
      if (destination === 'sidebar') sidebar?.openWebsite(url, { resolved: true });
      else if (destination === 'standalone') standalone?.openWebsite(url, { resolved: true });
      else if (isTauri()) await openUrl(url);
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      if (alive.current) void message.error({
        content: uiText('client.conversation.couldNotOpenTheLinkPleaseTryAgainShortly'),
        style: { maxWidth: 400, marginInline: 'auto' },
      });
    } finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  const copy = async () => {
    try { await copyText(href); }
    catch { void message.error({ content: uiText('client.chat.couldNotCopyTryAgain'),
      style: { maxWidth: 400, marginInline: 'auto' } }); }
  };
  return { open, copy, busy, sidebar: Boolean(sidebar), standalone: Boolean(standalone) };
}
