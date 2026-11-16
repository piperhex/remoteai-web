import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type WorkspaceLauncherId = 'git' | 'files';
export interface WorkspaceLauncher {
  id: WorkspaceLauncherId;
  tabId: string;
  enabled: boolean;
  open: () => void;
}
interface Registration extends WorkspaceLauncher { owner: symbol }
type RegisterLauncher = (launcher: WorkspaceLauncher) => () => void;

export const WorkspaceLaunchersContext = createContext<RegisterLauncher | null>(null);

/** Launchers keep host services with their existing tool buttons and panels. */
export function useWorkspaceLauncher(launcher: WorkspaceLauncher) {
  const register = useContext(WorkspaceLaunchersContext);
  const action = useRef(launcher.open);
  action.current = launcher.open;
  useEffect(() => register?.({ id: launcher.id, tabId: launcher.tabId,
    enabled: launcher.enabled, open: () => action.current() }),
    [register, launcher.id, launcher.tabId, launcher.enabled]);
}

export function useWorkspaceLaunchers() {
  const [entries, setEntries] = useState<Registration[]>([]);
  const register = useCallback<RegisterLauncher>(launcher => {
    const owner = Symbol(launcher.id);
    setEntries(current => [...current, { ...launcher, owner }]);
    return () => setEntries(current => current.filter(entry => entry.owner !== owner));
  }, []);
  const launchers = useMemo(() => new Map(entries.map(entry => [entry.id, entry])), [entries]);
  return { register, launchers };
}
