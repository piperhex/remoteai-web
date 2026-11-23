import { useEffect, useState } from 'react';
import type { SshApi } from '../ssh';
import { serverRates, type TimedSample } from './serverMetrics';

const SAMPLE_INTERVAL_MS = 4000;
const FIRST_DELTA_MS = 1000;
const RETRY_INTERVAL_MS = 20000;

interface Reading extends ReturnType<typeof serverRates> { values: TimedSample['values'] }

type Monitor = NonNullable<SshApi['monitor']>;
const inflight = new WeakMap<Monitor, Map<string, Promise<TimedSample>>>();

// Reattaching a view or returning quickly to a tab can reuse its unfinished sample.
function sample(monitor: Monitor, id: string) {
  const requests = inflight.get(monitor) ?? new Map<string, Promise<TimedSample>>();
  const pending = requests.get(id);
  if (pending) return pending;
  inflight.set(monitor, requests);
  const start = performance.now();
  const request = monitor(id).then(values => {
    if (!values || !('cpu' in values)) throw new Error();
    return { values, time: (start + performance.now()) / 2 };
  }).finally(() => requests.delete(id));
  requests.set(id, request);
  return request;
}

export function useServerMonitor(api: SshApi, id: string, enabled: boolean) {
  const [reading, setReading] = useState<Reading>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setReading(undefined);
    setFailed(false);
    if (!enabled || !api.monitor) return;
    const monitor = api.monitor;
    let disposed = false;
    let pending = false;
    let previous: TimedSample | undefined;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      if (disposed || pending || document.hidden) return;
      pending = true;
      let delay = SAMPLE_INTERVAL_MS;
      try {
        const current = await sample(monitor, id);
        if (disposed || document.hidden) return;
        setReading({ values: current.values, ...serverRates(current, previous) });
        setFailed(false);
        if (!previous) delay = FIRST_DELTA_MS;
        previous = current;
      } catch {
        if (!disposed) { setReading(undefined); setFailed(true); }
        previous = undefined;
        delay = RETRY_INTERVAL_MS;
      } finally {
        pending = false;
        if (!disposed && !document.hidden) timer = setTimeout(refresh, delay);
      }
    };
    const visibility = () => {
      clearTimeout(timer);
      previous = undefined;
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', visibility);
    void refresh();
    return () => {
      disposed = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [api, id, enabled]);
  return { reading: enabled ? reading : undefined, unavailable: failed || !api.monitor || !enabled };
}
