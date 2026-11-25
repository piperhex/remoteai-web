import { useState } from 'react';
import { Alert, Button, Spin, Tooltip } from 'antd';
import { ChevronRight, Monitor, MonitorOff, RefreshCw } from 'lucide-react';
import type { ChatComputer } from '../../remote-chat/devices';
import type { ComputerListRefresh } from '../../remote-chat/ComputerSearchBar';
import { displayError, t } from '../../localization/browserClient';
import { ConnectedDesktop, type DesktopConnectionFactory } from './ConnectedDesktop';
import type { LocalDesktopClipboard } from '../clipboard';
import './remoteDesktopPage.css';

interface Props {
  devices: ChatComputer[];
  directory: ComputerListRefresh;
  login?: () => void;
  connect: DesktopConnectionFactory;
  localClipboard?: LocalDesktopClipboard;
}

export function RemoteDesktopPage({ devices, directory, login, connect, localClipboard }: Props) {
  const [selected, setSelected] = useState<ChatComputer | null>(null);
  const title = t('client.remoteDesktop.remoteDesktop');
  const refresh = t('client.app.refreshDeviceList');
  return <section className="rd-page" aria-label={title}>
    <header className="rd-page-header">
      <Monitor size={21} aria-hidden="true" /><h1>{title}</h1>
      {selected && <span className="rd-page-host">{selected.name}</span>}
    </header>
    {selected ? <ConnectedDesktop deviceId={selected.deviceId} connect={connect}
      localClipboard={localClipboard} close={() => setSelected(null)} />
      : <div className="rd-page-directory">
        <div className="rd-page-directory-heading"><h2>{t('client.settings.chooseAComputer')}</h2>
          {!login && <Tooltip title={refresh}><Button aria-label={refresh} icon={<RefreshCw size={15} />}
            disabled={directory.loading} onClick={directory.refresh} /></Tooltip>}
        </div>
        {directory.error && <Alert type="warning" showIcon message={displayError(directory.error)} />}
        {devices.length > 0 ? <div className="rd-device-list">
          {devices.map(device => <button type="button" key={device.deviceId} disabled={!device.online}
            className="rd-device-row" onClick={() => setSelected(device)}>
            <span className="rd-device-icon"><Monitor size={21} /></span>
            <span className="rd-device-label"><strong>{device.name}</strong><small>{device.platform}</small></span>
            <span className="rd-device-presence">{t(device.online ? 'client.chat.online' : 'client.chat.offline')}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>)}
        </div> : <div className="rd-device-empty">
          {directory.loading ? <Spin /> : <><MonitorOff size={28} aria-hidden="true" />
            <p>{t(login ? 'client.app.pleaseSignInFirst' : 'client.mappingHub.noDevices')}</p>
            {login && <Button type="primary" onClick={login}>{t('client.lounge.login')}</Button>}</>}
        </div>}
      </div>}
  </section>;
}
