import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BrowserClientContext, localBrowserClient } from '../../file-preview/workspace/browserClient';
import type { BrowserReply } from '../automation';
import type { BrowserExtension, ChromeExtension, ExtensionRequest } from './model';
import type { MarketKey } from '../../provider-market/i18n';
import { browserFile, command, droppedExtensionFiles, uploadExtension } from './transfer';
import { downloadMarket, type MarketExtension } from './market';

export function useExtensions(active: boolean) {
  const client = useContext(BrowserClientContext);
  const [entries, setEntries] = useState<BrowserExtension[]>([]);
  const [candidates, setCandidates] = useState<ChromeExtension[]>([]);
  const [supported, setSupported] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number>();
  const [error, setError] = useState<MarketKey>();
  const generation = useRef(0), working = useRef(false);
  useEffect(() => {
    generation.current += 1; working.current = false;
    setBusy(false); setEntries([]); setCandidates([]); setSupported(undefined); setError(undefined);
    return () => { generation.current += 1; };
  }, [client]);
  const run = useCallback(async (operation: (current: () => boolean) => Promise<BrowserReply>) => {
    if (working.current) return false;
    working.current = true; setBusy(true); setError(undefined);
    const version = generation.current;
    const current = () => version === generation.current;
    try {
      const reply = await operation(current);
      if (!current()) return false;
      if (reply.entries) setEntries(reply.entries);
      if (reply.candidates) setCandidates(reply.candidates);
      if (reply.supported !== undefined) setSupported(reply.supported);
      return true;
    } catch (reason) {
      if (current()) {
        const keys: MarketKey[] = ['market.extensionsInvalid', 'market.extensionsFailed',
          'market.extensionsStorageFailed', 'market.extensionsMissing', 'market.extensionsUnsupported',
          'market.extensionsDropInvalid', 'market.extensionsDownloadFailed'];
        setError(keys.find(key => String(reason).includes(key)) ?? 'market.extensionsUnavailable');
      }
      return false;
    } finally {
      if (current()) { working.current = false; setBusy(false); setProgress(undefined); }
    }
  }, []);
  const request = useCallback((request: ExtensionRequest) => run(() => command(client, request)), [client, run]);
  const installMarket = (base: string, item: MarketExtension) => run(async current => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const file = await downloadMarket(base, item, controller.signal);
      if (!current()) throw new Error('market.extensionsUnavailable');
      setProgress(0);
      return await uploadExtension({ client, files: [browserFile(file)], current, progress: setProgress,
        market: { id: item.id, sha256: item.sha256 } });
    } finally { clearTimeout(timeout); }
  });
  const installDrop = (data: DataTransfer) => run(async current => {
    const files = await droppedExtensionFiles(data);
    setProgress(0);
    return uploadExtension({ client, files, current, progress: setProgress });
  });
  const installPaths = (paths: string[]) => run(async current => {
    if (paths.length !== 1) throw new Error('market.extensionsDropInvalid');
    if (client.native) return command(client, { action: 'install', path: paths[0] });
    // Native drag paths belong to the viewing PC, never to the remotely connected browser.
    const exported = (await command(localBrowserClient, { action: 'export', path: paths[0] })).transfer;
    if (!exported?.token || exported.size === undefined) throw new Error('market.extensionsFailed');
    const token = exported.token;
    try {
      setProgress(0);
      return await uploadExtension({ client, current, progress: setProgress, files: [{
        path: 'extension.zip', size: exported.size, read: async offset => {
          const result = await command(localBrowserClient, { action: 'readExport', token, offset });
          if (result.transfer?.data === undefined) throw new Error('market.extensionsFailed');
          return result.transfer.data;
        },
      }] });
    } finally {
      await command(localBrowserClient, { action: 'releaseTransfer', token }).catch(() => {
        console.warn('Local extension transfer cleanup deferred until session expiry');
      });
    }
  });
  useEffect(() => { if (active) void request({ action: 'list' }); }, [active, request]);
  return { entries, candidates, supported, busy, progress, error, request, installDrop, installPaths, installMarket,
    native: client.native, browseFiles: client.browseFiles, reportError: setError };
}
