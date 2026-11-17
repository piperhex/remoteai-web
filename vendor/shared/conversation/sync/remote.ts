import type { ChatConnection, ConnectionEvents } from '../../remote-chat/client/connection';
import { SYNC_OPERATION, type SyncHost, type SyncRequest } from './types';

/** A separate, lazy connection keeps synchronization independent of the visible conversation. */
export function remoteSyncHost(options: {
  id: string; name: string; connect: (events: ConnectionEvents) => ChatConnection;
  transfer?: SyncHost['transfer'];
}): SyncHost {
  let connection: ChatConnection | undefined;
  let ready: Promise<void> | undefined;
  let ended = false;
  let mode: ReturnType<NonNullable<SyncHost['mode']>> = 'offline';
  const start = () => {
    ready = new Promise<void>((resolve, reject) => {
      connection = options.connect({ ready: resolve, event: () => {}, mode: value => { mode = value; },
        error: message => reject(new Error(message)) });
      connection.start();
    });
    const attempt = ready;
    void attempt.catch(() => {
      if (ready !== attempt) return;
      ready = undefined; connection?.stop(); connection = undefined;
    });
  };
  return { id: options.id, name: options.name, mode: () => mode,
    transfer: options.transfer, nativeLink: () => connection?.nativeSync,
    request: async <T>(request: SyncRequest) => {
      if (ended) throw new Error('CONVERSATION_SYNC_CLOSED');
      if (!ready) start();
      await ready;
      if (ended || !connection) throw new Error('CONVERSATION_SYNC_CLOSED');
      return connection.request<T>('request', { operation: SYNC_OPERATION, request });
    },
    close: () => { ended = true; connection?.stop(); },
  };
}
