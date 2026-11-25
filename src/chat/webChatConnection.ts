import { apiJson, getActiveSession, refreshSession } from '../api';
import { ChatConnection, type ConnectionEvents } from '../../../../shared/remote-chat/client/connection';
import { createBrowserPacketCompression } from '../../../../shared/remote-chat/browserPacketCompression';
import { RtcPeer } from '../../../../shared/remote-chat/rtcPeer';
import { browserTrustStore, trustedHost, trustScope } from '../../../../shared/remote-chat/trustedHost';
import { CONNECTION_ERRORS } from '../../../../shared/remote-chat/connectionErrors';
import type { AuthSession } from '../types';

export function webChatConnection(session: Pick<AuthSession, 'baseUrl' | 'email'>,
  deviceId: string, events: ConnectionEvents) {
  const currentSession = () => {
    const current = getActiveSession();
    if (!current || current.baseUrl !== session.baseUrl || current.email !== session.email) {
      throw Object.assign(new Error(CONNECTION_ERRORS.expired), { status: 401 });
    }
    return current;
  };
  return new ChatConnection({ ...events, deviceId, managePolicyMode: false,
    createPacketCompression: createBrowserPacketCompression,
    verifyHostKey: trustedHost(browserTrustStore, trustScope(session.baseUrl, deviceId)),
    randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
    renewAuthorization: async () => {
      currentSession();
      await refreshSession();
    },
    authorize: async () => {
      await apiJson('/auth/me');
      return currentSession();
    },
    createPeer: (options) => new RtcPeer(options, () => new RTCPeerConnection({ iceServers: options.iceServers })),
  });
}
