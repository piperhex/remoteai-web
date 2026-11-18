import { contentHash, historyDelta, historyFields, type HistoryDelta, type HistoryVersion } from './historySync';
import { historyImageReference, replaceInlineImages, type HistoryImageReference } from './historyImages';
import type { Thread } from './client/types';

export type HistoryWork = { action: 'fields'; values: object[] }
  | { action: 'delta'; thread: Thread; known?: HistoryVersion };
export type HistoryWorkResult = { action: 'fields'; fields: HistoryVersion['fields'][] }
  | { action: 'delta'; delta: HistoryDelta; images: HistoryImageReference[] };

export function processHistoryWork(work: HistoryWork, hash = contentHash): HistoryWorkResult {
  if (work.action === 'fields') return { action: 'fields', fields: work.values.map(value => historyFields(value, '', hash)) };
  const images: HistoryImageReference[] = [];
  const snapshot = replaceInlineImages(work.thread, source => {
    const reference = historyImageReference(hash(source));
    images.push({ reference, source });
    return reference;
  });
  return { action: 'delta', delta: historyDelta(snapshot, work.known, hash), images };
}

const CACHE_MIN_CHARACTERS = 16 * 1024;
const CACHE_MAX_CHARACTERS = 8 * 1024 * 1024;

/** Host snapshots arrive as new objects, but typically contain the same large message strings. */
export function cachedHistoryHash() {
  const hashes = new Map<string, string>();
  let characters = 0;
  return (value: unknown): string => {
    if (typeof value !== 'string' || value.length < CACHE_MIN_CHARACTERS
      || value.length > CACHE_MAX_CHARACTERS) return contentHash(value);
    const cached = hashes.get(value);
    if (cached) {
      hashes.delete(value);
      hashes.set(value, cached);
      return cached;
    }
    for (const oldest of hashes.keys()) {
      if (characters + value.length <= CACHE_MAX_CHARACTERS) break;
      hashes.delete(oldest);
      characters -= oldest.length;
    }
    const hash = contentHash(value);
    characters += value.length;
    hashes.set(value, hash);
    return hash;
  };
}
