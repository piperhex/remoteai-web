import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Spin } from 'antd';
import type { ChatConnection, ConnectionEvents } from '../../remote-chat/client/connection';
import { displayError, t } from '../../localization/browserClient';
import type { LocalDesktopClipboard } from '../clipboard';
import { desktopClient } from '../protocol';
import { RemoteDesktop } from './RemoteDesktop';

export type DesktopConnectionFactory = (deviceId: string, events: ConnectionEvents) => ChatConnection;

export function ConnectedDesktop({ deviceId, connect, localClipboard, close }: {
  deviceId: string; connect: DesktopConnectionFactory; localClipboard?: LocalDesktopClipboard; close: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState('');
  const connection = useMemo(() => connect(deviceId, {
    mode: mode => { if (mode === 'offline' || mode === 'connecting') setReady(false); },
    ready: () => { setReady(true); setOpened(true); setError(''); },
    error: setError, event: () => {},
  }), [connect, deviceId]);
  const client = useMemo(() => desktopClient(body => connection.request('request', body),
    connection.reportDiagnostic, connection.openNativeMedia), [connection]);
  useEffect(() => {
    connection.start();
    return () => connection.stop();
  }, [connection]);
  return <>
    {error && <Alert type="warning" showIcon message={displayError(error)} />}
    <div className="rd-page-viewer">
      {opened ? <RemoteDesktop embedded client={client} active connected={ready} close={close}
        localClipboard={localClipboard} />
        : <div className="rd-page-connecting">
          {!error && <><Spin /><p role="status">{t('client.remoteDesktop.connectingToTheDesktop')}</p></>}
          <Button onClick={close}>{t('client.projectBrowser.close')}</Button>
        </div>}
    </div>
  </>;
}
