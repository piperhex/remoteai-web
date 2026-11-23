import { useEffect, useRef, useState } from 'react';
import { sshError } from '../ssh';
import type { TerminalApi, TerminalInfo } from '../types';
import { useTerminalPanel } from '../views/useTerminalPanel';

/** Only terminals explicitly opened by this workspace belong to it. */
export function useSshSessions(api: TerminalApi) {
  const panel = useTerminalPanel('');
  const owned = useRef(new Set<string>());
  const closing = useRef(new Set<string>());
  const [error, setError] = useState('');
  useEffect(() => {
    const sessions = owned.current;
    return () => {
      for (const id of sessions) {
        if (!closing.current.has(id)) void api.close(id).catch(() => console.warn('SSH session cleanup failed'));
      }
      sessions.clear();
    };
  }, [api]);
  const adopt = (info: TerminalInfo) => {
    owned.current.add(info.id);
    setError('');
    panel.adopt(info);
  };
  const remove = async (id: string) => {
    if (!owned.current.has(id) || closing.current.has(id)) return;
    closing.current.add(id);
    try {
      await api.close(id);
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
  return { ...panel, adopt, error, remove, removeTabs: (ids: string[]) => { ids.forEach(id => void remove(id)); } };
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
