import { useEffect, useRef, useState } from 'react';
import { sshError } from '../ssh';
import type { SshHost } from './useSshHosts';
import type { TerminalInfo } from '../types';
import { useTerminalPanel } from '../views/useTerminalPanel';

/** Only terminals explicitly opened by this workspace belong to it. */
export function useSshSessions() {
  const panel = useTerminalPanel('');
  const owned = useRef(new Map<string, SshHost>());
  const closing = useRef(new Set<string>());
  const [error, setError] = useState('');
  useEffect(() => {
    const sessions = owned.current;
    return () => {
      for (const [id, { api }] of sessions) {
        if (!closing.current.has(id)) void api.close(id).catch(() => console.warn('SSH session cleanup failed'));
      }
      sessions.clear();
    };
  }, []);
  const adopt = (info: TerminalInfo, host: SshHost) => {
    owned.current.set(info.id, host);
    setError('');
    panel.adopt(info);
  };
  const remove = async (id: string) => {
    const host = owned.current.get(id);
    if (!host || closing.current.has(id)) return;
    closing.current.add(id);
    try {
      await host.api.close(id);
      owned.current.delete(id);
      panel.remove(id);
      setError('');
    } catch (failure) {
      if (panel.tabs.find(tab => tab.id === id)?.exited) {
        owned.current.delete(id);
        panel.remove(id);
      } else setError(sshError(failure, 'client.ssh.connectionFailed'));
    } finally { closing.current.delete(id); }
  };
  const tabs = panel.tabs.map(tab => {
    const host = owned.current.get(tab.id)!;
    return { ...tab, host, subtitle: host.name };
  });
  return { ...panel, tabs, adopt, error, remove, removeTabs: (ids: string[]) => { ids.forEach(id => void remove(id)); } };
}

const RECENT_LIMIT = 6;

export function useRecentSshProfiles(scope: string) {
  const key = 'remoteai.ssh.recent:' + scope;
  const [ids, setIds] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, RECENT_LIMIT) : [];
    } catch { return []; }
  });
  const remember = (id: string) => {
    const next = [id, ...ids.filter(value => value !== id)].slice(0, RECENT_LIMIT);
    setIds(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Recents also work in memory. */ }
  };
  return { ids, remember };
}
