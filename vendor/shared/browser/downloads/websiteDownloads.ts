import { downloadManager } from '../../downloads/manager';
import { registerManagedDownloads } from '../../downloads/managedTasks';
import { resetDownload, storeChunk } from '../../downloads/storage';
import type { DownloadTask } from '../../downloads/types';

const FAILURE = 'client.downloads.browser.failed';
const BLOCK_BYTES = 1024 * 1024;

export function enqueueWebsiteDownload(owner: string, url: URL, filename: string) {
  if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new Error(FAILURE);
  }
  const candidate = (filename || url.pathname.split('/').pop() || '').trim();
  const name = candidate.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 150).replace(/^\.+$/, '') || 'download';
  url.hash = '';
  const task: DownloadTask = { id: crypto.randomUUID(), name,
    source: { owner, deviceId: 'browser', deviceName: url.host, scope: 'computer', path: name },
    website: url.href, status: 'queued', received: 0, size: 0, createdAt: Date.now(), message: '' };
  return downloadManager.enqueueManaged(task);
}

async function downloadWebsiteFile({ task, signal, update }: {
  task: DownloadTask; signal: AbortSignal; update: (value: DownloadTask) => void;
}): Promise<DownloadTask> {
  if (!task.website) throw new Error(FAILURE);
  const response = await fetch(task.website, { mode: 'same-origin', credentials: 'same-origin', signal });
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
      const { value, done } = await reader.read();
      if (done) break;
      parts.push(value.slice()); bytes += value.byteLength;
      if (bytes >= BLOCK_BYTES) await flush();
    }
    await flush();
    if (size && current.received !== size) throw new Error(FAILURE);
    return { ...current, status: 'ready', size: current.received, completedAt: Date.now() };
  } finally {
    await reader?.cancel().catch(() => {});
    reader?.releaseLock();
  }
}

registerManagedDownloads({ matches: task => Boolean(task.website),
  connected: () => true, run: downloadWebsiteFile, retryable: () => false });
