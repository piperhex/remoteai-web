import { formatRelayBytes } from '../../remote-chat/relayUsage';
import type { ServerSample } from '../ssh';

export interface TimedSample { values: ServerSample; time: number }
const difference = (next: number, last: number) => next >= last ? next - last : undefined;

export function serverRates(current: TimedSample, previous?: TimedSample) {
  const value = current.values;
  const last = previous?.values;
  const elapsed = previous ? (current.time - previous.time) / 1000 : 0;
  let cpu = value.cpuPercent ?? undefined;
  if (value.cpu && last?.cpu) {
    const total = difference(value.cpu[0], last.cpu[0]);
    const idle = difference(value.cpu[1], last.cpu[1]);
    if (total && idle !== undefined && idle <= total) cpu = Math.round(100 * (1 - idle / total));
  }
  const speed = (index: number) => {
    if (!value.network || !last?.network || elapsed <= 0) return;
    const bytes = difference(value.network[index], last.network[index]);
    return bytes === undefined ? undefined : bytes / elapsed;
  };
  return { cpu, download: speed(0), upload: speed(1) };
}

export function formatServerSpeed(bytes: number | undefined, locale: string) {
  return bytes !== undefined && Number.isFinite(bytes) && bytes >= 0 ? formatRelayBytes(bytes, locale) + '/s' : '—';
}
