import { downloadManager } from '../../downloads/manager';
import { registerManagedDownloads } from '../../downloads/managedTasks';
import { resetDownload, storeChunk } from '../../downloads/storage';
import type { DownloadTask } from '../../downloads/types';

const FAILURE = 'client.downloads.browser.failed';
const BLOCK_BYTES = 1024 * 1024;
const GENERATED_FILE = 'generated:';
const pageFiles = new Map<string, Promise<Blob>>();

export async function enqueueWebsiteDownload(owner: string, url: URL, filename: string) {
  const generated = url.protocol === 'blob:' || url.protocol === 'data:';
  if (!/^(?:https?|blob|data):$/.test(url.protocol)
    || (url.protocol !== 'data:' && url.origin !== window.location.origin) || url.username || url.password) {
    throw new Error(FAILURE);
  }
  const candidate = (filename || (generated ? '' : url.pathname.split('/').pop()) || '').trim();
  const name = candidate.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 150).replace(/^\.+$/, '') || 'download';
  url.hash = '';
  const task: DownloadTask = { id: crypto.randomUUID(), name,
    source: { owner, deviceId: 'browser', deviceName: generated ? location.host : url.host,
      scope: 'computer', path: name },
    website: generated ? GENERATED_FILE : url.href,
    status: 'queued', received: 0, size: 0, createdAt: Date.now(), message: '' };
  if (generated) {
    // Capture the object URL before the webpage's event handler returns and revokes it.
    const file = fetch(url).then(response => {
      if (!response.ok) throw new Error(FAILURE);
      return response.blob();
    });
    void file.catch(() => {}); // The task consumes the rejection when it starts.
    pageFiles.set(task.id, file);
  }
  try { return await downloadManager.enqueueManaged(task); }
  catch (error) { pageFiles.delete(task.id); throw error; }
}

async function websiteResponse(task: DownloadTask, signal: AbortSignal) {
  if (!task.website) throw new Error(FAILURE);
  if (task.website !== GENERATED_FILE) return fetch(task.website, { mode: 'same-origin', credentials: 'same-origin', signal });
  const blob = await pageFiles.get(task.id);
  if (!blob) throw new Error('client.downloads.browser.unavailable');
  signal.throwIfAborted();
  return new Response(blob, { headers: { 'Content-Length': String(blob.size), 'Content-Type': blob.type } });
}

async function downloadWebsiteFile({ task, signal, update }: {
  task: DownloadTask; signal: AbortSignal; update: (value: DownloadTask) => void;
}): Promise<DownloadTask> {
  const response = await websiteResponse(task, signal);
  if (!response.ok || response.status === 206) throw new Error(FAILURE);
  const size = response.headers.has('content-encoding') ? 0 : Number(response.headers.get('content-length')) || 0;
  const mimeType = response.headers.get('content-type')?.split(';')[0];
  const current = { ...task, status: 'downloading' as const, received: 0, size, mimeType, message: '' };
  const reader = response.body?.getReader();
  let parts: BlobPart[] = [], bytes = 0;
  const flush = async () => {
    if (!bytes) return;
    const offset = current.received;
    current.received += bytes;
    if (current.size && current.received > current.size) throw new Error(FAILURE);
    await storeChunk(current, offset, new Blob(parts));
    parts = []; bytes = 0;
    update({ ...current });
  };
  try {
    await resetDownload(current);
    update(current);
    if (!reader) return { ...current, status: 'ready', size: 0, completedAt: Date.now() };
    for (;;) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      parts.push(value.slice()); bytes += value.byteLength;
      if (bytes >= BLOCK_BYTES) await flush();
    }
    await flush();
    if (size && current.received !== size) throw new Error(FAILURE);
    pageFiles.delete(task.id);
    return { ...current, status: 'ready', size: current.received, completedAt: Date.now() };
  } finally {
    await reader?.cancel().catch(() => {});
    reader?.releaseLock();
  }
}

registerManagedDownloads({ matches: task => Boolean(task.website),
  connected: task => task.website !== GENERATED_FILE || pageFiles.has(task.id),
  run: downloadWebsiteFile, retryable: () => false, remove: async task => { pageFiles.delete(task.id); } });
