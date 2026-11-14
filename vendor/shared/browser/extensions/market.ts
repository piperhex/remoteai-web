import { createContext } from 'react';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

export const ExtensionMarketContext = createContext<string | undefined>(undefined);
export interface MarketExtension {
  id: string; name: string; description: string; version: string; icon?: string;
  permissions: string[]; sha256: string; size: number;
}
const MAX_PACKAGE_BYTES = 64 * 1024 * 1024;
const MAX_CATALOG_BYTES = 32 * 1024 * 1024;
const ID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const invalid = () => new Error('market.extensionsDownloadFailed');
function endpoint(base: string) {
  const url = new URL(base);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw invalid();
  return base.replace(/\/+$/, '') + '/browser-extensions';
}

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

function isEntry(value: unknown): value is MarketExtension {
  if (!value || typeof value !== 'object') return false;
  const item = value as MarketExtension;
  return typeof item.id === 'string' && ID.test(item.id) && typeof item.sha256 === 'string' && DIGEST.test(item.sha256)
    && typeof item.name === 'string' && item.name.length <= 512
    && typeof item.description === 'string' && item.description.length <= 4096
    && typeof item.version === 'string' && item.version.length <= 23
    && Number.isSafeInteger(item.size) && item.size > 0 && item.size <= MAX_PACKAGE_BYTES
    && (item.icon === undefined || typeof item.icon === 'string' && item.icon.length <= 180_000)
    && Array.isArray(item.permissions) && item.permissions.length <= 500
    && item.permissions.every(permission => typeof permission === 'string' && permission.length <= 2048);
}

export async function listMarket(base: string, signal: AbortSignal): Promise<MarketExtension[]> {
  const response = await fetch(endpoint(base), { signal, cache: 'no-store', credentials: 'omit' });
  const value: unknown = JSON.parse(new TextDecoder().decode(await read(response, MAX_CATALOG_BYTES)));
  if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items)
    || !value.items.every(isEntry) || new Set(value.items.map(item => item.id)).size !== value.items.length) throw invalid();
  return value.items;
}

export async function downloadMarket(base: string, item: MarketExtension, signal: AbortSignal): Promise<File> {
  if (!isEntry(item)) throw invalid();
  const response = await fetch(`${endpoint(base)}/${item.id}/archive?sha256=${item.sha256}`,
    { signal, cache: 'no-store', credentials: 'omit', redirect: 'error' });
  const bytes = await read(response, item.size);
  if (bytes.length !== item.size || bytesToHex(sha256(bytes)) !== item.sha256) throw invalid();
  return new File([bytes], 'extension.zip', { type: 'application/zip' });
}
