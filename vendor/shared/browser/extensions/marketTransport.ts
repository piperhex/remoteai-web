import { toByteArray } from 'base64-js';
import { hasLocalBackend, invoke } from '../../platform/localBackend';

export interface MarketArchive { id: string; sha256: string; size: number }
const MAX_CATALOG_BYTES = 32 * 1024 * 1024;
const invalid = () => new Error('market.extensionsDownloadFailed');

async function read(response: Response, limit: number) {
  if (!response.ok || !response.body || Number(response.headers.get('Content-Length')) > limit) throw invalid();
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw invalid();
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

async function readNative(base: string, archive: MarketArchive | undefined, signal: AbortSignal) {
  signal.throwIfAborted();
  let abort = () => {};
  const cancelled = new Promise<never>((_resolve, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    // Use the viewing host's network, including in remote mode. The selected computer only installs the archive.
    const encoded = await Promise.race([cancelled, invoke<string>('fetch_browser_extension_market', {
      baseUrl: base, archive: archive ?? null,
    })]);
    const limit = archive?.size ?? MAX_CATALOG_BYTES;
    if (encoded.length > Math.ceil(limit / 3) * 4) throw invalid();
    const bytes = toByteArray(encoded);
    if (bytes.length > limit) throw invalid();
    return bytes;
  } finally { signal.removeEventListener('abort', abort); }
}

export async function readMarket(base: string, signal: AbortSignal, archive?: MarketArchive) {
  const url = new URL(base);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw invalid();
  }
  if (hasLocalBackend) return readNative(base, archive, signal);
  const endpoint = base.replace(/\/+$/, '') + '/browser-extensions';
  const path = archive ? `${endpoint}/${archive.id}/archive?sha256=${archive.sha256}` : endpoint;
  const response = await fetch(path, { signal, cache: 'no-store', credentials: 'omit',
    ...(archive ? { redirect: 'error' as const } : {}) });
  return read(response, archive?.size ?? MAX_CATALOG_BYTES);
}
