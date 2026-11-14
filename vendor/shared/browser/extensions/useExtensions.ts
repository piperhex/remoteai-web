import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BrowserClientContext } from '../../file-preview/workspace/browserClient';
import type { BrowserExtension, ChromeExtension, ExtensionRequest } from './model';
import type { MarketKey } from '../../provider-market/i18n';

export function useExtensions(active: boolean) {
  const client = useContext(BrowserClientContext);
  const [entries, setEntries] = useState<BrowserExtension[]>([]);
  const [candidates, setCandidates] = useState<ChromeExtension[]>([]);
  const [supported, setSupported] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MarketKey>();
  const generation = useRef(0), working = useRef(false);
  useEffect(() => { generation.current += 1; working.current = false;
    setBusy(false); setEntries([]); setCandidates([]); setSupported(undefined);
    return () => { generation.current += 1; };
  }, [client]);
  const request = useCallback(async (request: ExtensionRequest) => {
    if (working.current) return false;
    working.current = true; setBusy(true); setError(undefined);
    const current = generation.current;
    try {
      const reply = await client.request({ threadId: 'browser-extensions',
        command: { action: 'extensions', request } });
      if (current !== generation.current) return false;
      if (reply.entries) setEntries(reply.entries);
      if (reply.candidates) setCandidates(reply.candidates);
      if (reply.supported !== undefined) setSupported(reply.supported);
      return true;
    } catch (reason) {
      if (current === generation.current) {
        const keys: MarketKey[] = ['market.extensionsInvalid', 'market.extensionsFailed',
          'market.extensionsStorageFailed', 'market.extensionsMissing', 'market.extensionsUnsupported'];
        const known = keys.find(key => String(reason).includes(key));
        setError(known ?? 'market.extensionsUnavailable');
      }
      return false;
    } finally { if (current === generation.current) { working.current = false; setBusy(false); } }
  }, [client]);
  useEffect(() => { if (active) void request({ action: 'list' }); }, [active, request]);
  return { entries, candidates, supported, busy, error, request, native: client.native };
}
