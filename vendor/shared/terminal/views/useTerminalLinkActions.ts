import { useContext, useEffect, useRef, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { BrowserNavigationContext } from '../../browser/BrowserNavigationProvider';
import { DetailsContext } from '../../conversation/detailsContext';
import { remoteErrorText } from '../../localization/errors';
import { websiteUrl } from '../links';
import type { TerminalApi } from '../types';

export type TerminalLinkDestination = 'sidebar' | 'standalone' | 'external';

export function useTerminalLinkActions({ url: source, id, api, close, translate: t }: {
  url: string; id?: string; api: TerminalApi; close: () => void; translate: (source: string) => string;
}) {
  const sidebar = useContext(DetailsContext);
  const standalone = useContext(BrowserNavigationContext);
  const alive = useRef(true);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const open = async (destination: TerminalLinkDestination) => {
    if (pending.current || !websiteUrl(source)) return;
    if (destination === 'sidebar' && !sidebar || destination === 'standalone' && !standalone) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (api.resolveLink && !id) {
        throw new Error(t('client.terminal.unableToConnectToTheTerminalCheckThatYourComputer'));
      }
      const url = api.resolveLink && id ? await api.resolveLink(id, source) : source;
      if (!alive.current) return;
      if (!websiteUrl(url)) throw new Error(t('client.terminal.checkTheLinkAndTryAgain'));
      // The terminal owns address resolution; browser contexts must not forward the resolved URL again.
      if (destination === 'sidebar') sidebar?.openWebsite(url, { resolved: true });
      else if (destination === 'standalone') standalone?.openWebsite(url, { resolved: true });
      else if (isTauri()) await openUrl(url);
      else window.open(url, '_blank', 'noopener,noreferrer');
      if (alive.current) close();
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? remoteErrorText(failure)
        : t('client.conversation.couldNotOpenTheLinkPleaseTryAgainShortly'));
    } finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  return { open, busy, error, sidebar: Boolean(sidebar), standalone: Boolean(standalone) };
}
