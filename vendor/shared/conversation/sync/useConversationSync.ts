import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { closePreparedSync, prepareSync, type PreparedSync } from './transfer';
import { SYNC_HOME_ID, type SyncDirectory, type SyncHost, type SyncResult, type SyncSource,
  type SyncThread, type SyncProvider } from './types';
import { useGuiLanguage } from '../../localization/useGuiLanguage';
import { uiText } from '../../localization/uiText';
import { downloadManager } from '../../downloads/manager';
import { enqueueSyncDownload, syncTransferMode } from './downloads';
import { orderSyncSources, syncSourceLabel } from './sourceLabel';
import { uniqueSyncThreads } from './threadGroups';

export function useSyncSources(hosts: SyncHost[], destination: SyncHost) {
  const language = useGuiLanguage();
  const [sources, setSources] = useState<SyncSource[]>([]);
  const [failures, setFailures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.allSettled(hosts.map(async host => {
      const directory = await host.request<SyncDirectory>({ action: 'homes' });
      return directory.homes.filter(home => host.id !== destination.id || home.id !== SYNC_HOME_ID)
        .map(home => ({ key: JSON.stringify([host.id, home.id]), host, home,
          label: syncSourceLabel(host.name || directory.name, home) }));
    })).then(results => {
      if (cancelled) return;
      setSources(orderSyncSources(results.flatMap(result => result.status === 'fulfilled' ? result.value : [])));
      setFailures(results.flatMap((result, index) => result.status === 'rejected'
        ? [hosts[index].name || uiText('client.git.local')] : []));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [hosts, destination.id, attempt, language]);
  return { sources, failures, loading, retry: () => retry(value => value + 1) };
}

export function useSyncThreads(source?: SyncSource) {
  const [listedSource, setListedSource] = useState(source?.key);
  const [threads, setThreads] = useState<SyncThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [revision, refresh] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    setListedSource(source?.key); setQuery(''); setSelected([]); setThreads([]);
  }, [source?.key]);
  useEffect(() => {
    const id = ++generation.current;
    if (!source) return;
    setLoading(true); setError(undefined);
    const timer = setTimeout(() => {
      void source.host.request<SyncThread[]>({ action: 'list', homeId: source.home.id, query })
        .then(result => {
          if (generation.current !== id) return;
          const threads = uniqueSyncThreads(result);
          const available = new Set(threads.map(thread => thread.sessionId));
          setThreads(threads);
          setSelected(current => current.filter(id => available.has(id)));
        }).catch(error => { if (generation.current === id) setError(error); })
        .finally(() => { if (generation.current === id) setLoading(false); });
    }, query ? 300 : 0);
    return () => { clearTimeout(timer); generation.current += 1; };
  }, [source?.key, query, revision]);
  const currentSource = listedSource === source?.key;
  return { threads: currentSource ? threads : [], loading: loading || !currentSource,
    error: currentSource ? error : undefined, query: currentSource ? query : '', setQuery,
    selected: currentSource ? selected : [], setSelected,
    refresh: () => refresh(value => value + 1) };
}

export function useConversationSync(options: {
  destination: SyncHost; source?: SyncSource; selected: string[]; complete: (result: SyncResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState<PreparedSync>();
  const [error, setError] = useState<unknown>();
  const [overwrite, setOverwrite] = useState(false);
  const [provider, setProvider] = useState<SyncProvider>('codex-switch-gui');
  const [taskId, setTaskId] = useState<string>();
  const tasks = useSyncExternalStore(downloadManager.subscribe, downloadManager.snapshot);
  const task = tasks.find(task => task.id === taskId);
  const abort = useRef<AbortController>();
  const preparedRef = useRef<PreparedSync>();
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const complete = useRef(options.complete); complete.current = options.complete;
  const destination = options.destination;
  const cancel = useCallback(() => {
    abort.current?.abort();
    const current = preparedRef.current;
    preparedRef.current = undefined;
    if (current) void closePreparedSync(destination, current);
    setOpen(false); setPrepared(undefined); setTaskId(undefined);
  }, [destination]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; abort.current?.abort();
      if (preparedRef.current) void closePreparedSync(destination, preparedRef.current);
    };
  }, [destination]);
  useEffect(() => {
    if (task?.status !== 'completed' || !task.sync?.result) return;
    complete.current(task.sync.result); cancel();
  }, [task?.status, taskId, cancel]);
  const show = async () => {
    if (inFlight.current || !options.source || !options.selected.length) return;
    inFlight.current = true;
    const controller = new AbortController(); abort.current = controller;
    setOpen(true); setPreparing(true); setError(undefined); setOverwrite(false);
    setPrepared(undefined); setTaskId(undefined); setProvider('codex-switch-gui');
    try {
      const result = await prepareSync({ source: options.source, destination,
        sessionIds: [...options.selected], signal: controller.signal });
      if (!mounted.current || controller.signal.aborted) {
        await closePreparedSync(destination, result); return;
      }
      preparedRef.current = result; setPrepared(result);
    } catch (error) {
      if (mounted.current && !controller.signal.aborted) setError(error);
    } finally { inFlight.current = false; if (mounted.current) setPreparing(false); }
  };
  const commit = async () => {
    if (inFlight.current || !prepared || !options.source) return;
    if (taskId) { await downloadManager.resume(taskId); return; }
    inFlight.current = true; setPreparing(true); setError(undefined);
    try {
      const id = await enqueueSyncDownload({ prepared, source: options.source.host, destination,
        overwriteIds: overwrite ? prepared.plan.duplicateIds : [], provider });
      preparedRef.current = undefined;
      if (mounted.current) setTaskId(id);
    } catch (error) { if (mounted.current) setError(error); }
    finally { inFlight.current = false; if (mounted.current) setPreparing(false); }
  };
  const busy = preparing || !!task && ['queued', 'preparing', 'downloading', 'verifying'].includes(task.status);
  return { open, busy, committing: task?.status === 'verifying', transferring: task?.status === 'downloading',
    task, progress: task?.size ? task.received / task.size : 0,
    transfer: { bytesPerSecond: task?.bytesPerSecond ?? 0,
      mode: options.source ? syncTransferMode(options.source.host, destination) : 'connecting' },
    prepared, error: error ?? (task?.status === 'failed' ? task.message : undefined),
    overwrite, setOverwrite, provider, setProvider, cancel, show, commit,
    pause: () => taskId ? downloadManager.pause(taskId) : Promise.resolve() };
}
