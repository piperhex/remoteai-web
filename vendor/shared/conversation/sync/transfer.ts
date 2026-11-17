import { SYNC_CHUNK_BYTES, SYNC_LEGACY_CHUNK_BYTES,
  type SyncBundle, type SyncHost, type SyncPlan, type SyncSource } from './types';
import { syncAwait } from './abort';

export interface PreparedSync {
  id: string;
  plan: SyncPlan;
  bundle: SyncBundle;
  remote?: { host: SyncHost; bundle: SyncBundle };
}

export async function prepareSync(options: {
  source: SyncSource; destination: SyncHost; sessionIds: string[]; signal: AbortSignal;
}): Promise<PreparedSync> {
  const { source, destination, sessionIds, signal } = options;
  const sameHost = source.host.id === destination.id;
  let exported: SyncBundle | undefined;
  let imported: SyncBundle | undefined;
  try {
    signal.throwIfAborted();
    exported = await source.host.request<SyncBundle>({
      action: sameHost ? 'prepare' : 'export', homeId: source.home.id, sessionIds,
    });
    signal.throwIfAborted();
    imported = sameHost ? exported : await destination.request<SyncBundle>({
      action: 'begin', size: exported.size, sha256: exported.sha256,
    });
    signal.throwIfAborted();
    const plan = await destination.request<SyncPlan>({ action: 'plan', id: imported.id,
      ...(!sameHost ? { sessionIds: exported.sessionIds } : {}) });
    return { id: imported.id, plan, bundle: { ...imported, originalSize: exported.originalSize },
      ...(!sameHost ? { remote: { host: source.host, bundle: exported } } : {}) };
  } catch (error) {
    if (imported) await closeTransfer(destination, imported.id);
    else if (sameHost && exported) await closeTransfer(source.host, exported.id);
    if (!sameHost && exported) await closeTransfer(source.host, exported.id);
    throw error;
  }
}

export async function uploadPreparedSync(options: {
  prepared: PreparedSync; destination: SyncHost; signal: AbortSignal;
  progress: (fraction: number, bytes: number) => void | Promise<void>;
  offset?: number;
}) {
  const { prepared, destination, signal, progress } = options;
  const remote = prepared.remote;
  if (!remote) return;
  const { host, bundle } = remote;
  const transfer = destination.transfer ?? host.transfer;
  if (transfer && await transfer({ source: host, destination, sourceBundle: bundle, destinationBundle: prepared.bundle,
    offset: options.offset ?? 0, signal, progress })) return;
  const chunkBytes = Math.min(bundle.chunkBytes ?? SYNC_LEGACY_CHUNK_BYTES,
    prepared.bundle.chunkBytes ?? SYNC_LEGACY_CHUNK_BYTES, SYNC_CHUNK_BYTES);
  // Bounded read-ahead hides the source round trip behind the destination write.
  // Writes remain ordered, so the receiver's acknowledged prefix is always resumable.
  const reads = new Map<number, Promise<{ data: string }>>();
  const fill = (offset: number) => {
    for (let next = offset; next < bundle.size && reads.size < 4; next += chunkBytes) {
      if (reads.has(next)) continue;
      const read = host.request<{ data: string }>({ action: 'read', id: bundle.id, offset: next,
        ...(bundle.chunkBytes ? { length: chunkBytes } : {}) });
      void read.catch(() => {}); // Awaited below or drained in finally after cancellation.
      reads.set(next, read);
    }
  };
  try {
    for (let offset = options.offset ?? 0; offset < bundle.size; offset += chunkBytes) {
      signal.throwIfAborted(); fill(offset);
      const { data } = await syncAwait(reads.get(offset)!, signal);
      reads.delete(offset);
      signal.throwIfAborted();
      const bytes = Math.min(chunkBytes, bundle.size - offset);
      const actual = data.length * 3 / 4 - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
      if (actual !== bytes) throw new Error('CONVERSATION_SYNC_INVALID');
      await syncAwait(destination.request({ action: 'write', id: prepared.id, offset, data }), signal);
      await progress(Math.min(1, (offset + bytes) / bundle.size), bytes);
    }
    signal.throwIfAborted();
  } finally { void Promise.allSettled(reads.values()); }
}

export async function closePreparedSync(destination: SyncHost, prepared: PreparedSync) {
  await closeTransfer(destination, prepared.id);
  if (prepared.remote) await closeTransfer(prepared.remote.host, prepared.remote.bundle.id);
}

export async function closeTransfer(host: SyncHost, id: string) {
  try { await host.request({ action: 'close', id }); return true; }
  catch { return false; /* The host also expires abandoned temporary bundles. */ }
}
