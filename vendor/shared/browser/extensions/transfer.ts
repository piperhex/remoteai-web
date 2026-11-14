import { fromByteArray } from 'base64-js';
import type { BrowserClient, BrowserReply } from '../automation';
import type { ExtensionRequest } from './model';

export const MAX_EXTENSION_BYTES = 256 * 1024 * 1024;
const CHUNK_BYTES = 192 * 1024;
const MAX_FILES = 20_000;
export interface ExtensionFile { path: string; size: number; read: (offset: number) => Promise<string> }
export const command = (client: BrowserClient, request: ExtensionRequest) =>
  client.request({ threadId: 'browser-extensions', command: { action: 'extensions', request } });

export function browserFile(file: File, path = file.name): ExtensionFile {
  return { path, size: file.size, read: async offset =>
    fromByteArray(new Uint8Array(await file.slice(offset, offset + CHUNK_BYTES).arrayBuffer())) };
}

export async function uploadExtension(options: { client: BrowserClient; files: ExtensionFile[];
  market?: { id: string; sha256: string };
  current: () => boolean; progress: (percent: number) => void }): Promise<BrowserReply> {
  const { client, files, current, progress } = options;
  const size = files.reduce((sum, file) => sum + file.size, 0);
  if (!files.length || files.length > MAX_FILES || size > MAX_EXTENSION_BYTES) {
    throw new Error('market.extensionsDropInvalid');
  }
  const started = await command(client, { action: 'beginUpload', files: files.map(({ path, size }) => ({ path, size })) });
  const token = started.transfer?.token;
  if (!token) throw new Error('market.extensionsFailed');
  let done = 0;
  try {
    for (const file of files) for (let offset = 0; offset < file.size; offset += CHUNK_BYTES) {
      if (!current()) throw new Error('market.extensionsUnavailable');
      const data = await file.read(offset);
      await command(client, { action: 'writeUpload', token, path: file.path, offset, data });
      done += Math.min(CHUNK_BYTES, file.size - offset);
      progress(Math.round(done * 100 / Math.max(1, size)));
    }
    if (!current()) throw new Error('market.extensionsUnavailable');
    return await command(client, { action: 'finishUpload', token, ...(options.market ? { market: options.market } : {}) });
  } finally {
    await command(client, { action: 'releaseTransfer', token }).catch(() => {
      console.warn('Extension transfer cleanup deferred until session expiry');
    });
  }
}

export async function droppedExtensionFiles(data: DataTransfer): Promise<ExtensionFile[]> {
  // Capture entries before the browser retires the drag event's protected data store.
  const entries = Array.from(data.items ?? []).map(item => item.webkitGetAsEntry?.()).filter(entry => !!entry);
  const fallback = Array.from(data.files);
  if (!entries.length) return fallback.map(file => browserFile(file));
  const files: ExtensionFile[] = [];
  let size = 0, count = 0;
  const queue = entries.map(entry => ({ entry, parent: '' }));
  while (queue.length) {
    const { entry, parent } = queue.shift()!;
    if (++count > MAX_FILES) throw new Error('market.extensionsDropInvalid');
    const path = parent + entry.name;
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      size += file.size;
      if (size > MAX_EXTENSION_BYTES) throw new Error('market.extensionsDropInvalid');
      files.push(browserFile(file, path)); continue;
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    for (;;) {
      const children = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (!children.length) break;
      queue.push(...children.map(entry => ({ entry, parent: path + '/' })));
      if (queue.length + count > MAX_FILES) throw new Error('market.extensionsDropInvalid');
    }
  }
  return files;
}
