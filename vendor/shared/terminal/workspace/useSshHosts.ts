import { useCallback, useState } from 'react';
import type { TerminalApi } from '../types';

export interface SshHost {
  deviceId: string;
  name: string;
  api: TerminalApi;
  ready: boolean;
  error?: string;
}
export type ReportSshHost = (id: string, host?: SshHost) => void;

/** Reuse each computer's authenticated transport independently of the visible chat. */
export function useSshHosts(scope: string) {
  const [hosts, setHosts] = useState(new Map<string, SshHost>());
  const [requested, setRequested] = useState<{ scope: string; id: string }>();
  const report = useCallback<ReportSshHost>((id, host) => {
    const key = JSON.stringify([scope, id]);
    setHosts(current => {
      const next = new Map(current);
      if (host) next.set(key, host);
      else next.delete(key);
      return next;
    });
  }, [scope]);
  return {
    report, get: (id: string) => hosts.get(JSON.stringify([scope, id])),
    request: (id: string) => setRequested({ scope, id }),
    requestedId: requested?.scope === scope ? requested.id : undefined,
  };
}
