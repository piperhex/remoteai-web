import { useCallback } from 'react';
import type { AuthSession, RemoteDevice } from '../types';
import type { ConnectionEvents } from '../../../../shared/remote-chat/client/connection';
import { RemoteDesktopPage } from '../../../../shared/remote-desktop/views/RemoteDesktopPage';
import { useComputerListRefresh } from './useComputerListRefresh';
import { webChatConnection } from './webChatConnection';

export default function WebRemoteDesktopPage({ session, devices }: { session: AuthSession; devices: RemoteDevice[] }) {
  const directory = useComputerListRefresh();
  const { baseUrl, email } = session;
  const connect = useCallback((deviceId: string, events: ConnectionEvents) =>
    webChatConnection({ baseUrl, email }, deviceId, events), [baseUrl, email]);
  return <RemoteDesktopPage devices={devices} directory={directory} connect={connect} />;
}
