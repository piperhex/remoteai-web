import { isInlineImage } from '../chat/imageSources';

const INLINE_IMAGE_PREFIX = 'chat-image://';
const INLINE_IMAGES = /data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+/gi;

export interface HistoryImageReference { reference: string; source: string }

export function historyImageReference(hash: string) { return `${INLINE_IMAGE_PREFIX}${hash}`; }
export function isHistoryImageReference(source: string) { return source.startsWith(INLINE_IMAGE_PREFIX); }

/** Share the exact image representation used by live events and history snapshots. */
export function replaceInlineImages<T>(value: T, remember: (source: string) => string): T {
  const visit = (entry: unknown): unknown => {
    if (typeof entry === 'string') {
      return isInlineImage(entry) ? remember(entry) : entry.replace(INLINE_IMAGES, remember);
    }
    if (Array.isArray(entry)) return entry.map(visit);
    if (!entry || typeof entry !== 'object') return entry;
    const record = entry as Record<string, unknown>;
    if (record.type === 'image' && typeof record.data === 'string' && typeof record.mimeType === 'string') {
      const source = `data:${record.mimeType};base64,${record.data}`;
      if (isInlineImage(source)) {
        // Normalize MCP image blocks to the URL-based form supported by remote clients.
        const { data: _data, mimeType: _mimeType, ...metadata } = record;
        return { ...metadata, type: 'inputImage', imageUrl: remember(source) };
      }
    }
    const result = { ...record };
    if (record.type === 'imageGeneration' && typeof record.result === 'string'
      && /^[a-z0-9+/=]+$/i.test(record.result)) result.result = `data:image/png;base64,${record.result}`;
    return Object.fromEntries(Object.entries(result).map(([key, data]) => [key, visit(data)]));
  };
  return visit(value) as T;
}
