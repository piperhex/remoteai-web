import { useState } from 'react';
import { Alert, Button, Spin, Tabs, Tooltip } from 'antd';
import { ChevronRight, Monitor, MonitorOff, RefreshCw, X } from 'lucide-react';
import type { ChatComputer } from '../../remote-chat/devices';
import type { ComputerListRefresh } from '../../remote-chat/ComputerSearchBar';
import { displayError, t } from '../../localization/browserClient';
import { useViewActive } from '../../RetainedView';
import { ConnectedDesktop, type DesktopConnectionFactory } from './ConnectedDesktop';
import { AddDesktopMenu } from './AddDesktopMenu';
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
  const active = useViewActive();
  const [workspace, setWorkspace] = useState<{ tabs: ChatComputer[]; selected?: string }>({ tabs: [] });
  const { tabs, selected } = workspace;
  const open = (device: ChatComputer) => setWorkspace(current => ({
    tabs: current.tabs.some(tab => tab.deviceId === device.deviceId) ? current.tabs : [...current.tabs, device],
    selected: device.deviceId,
  }));
  const close = (id: string) => setWorkspace(current => {
    const index = current.tabs.findIndex(tab => tab.deviceId === id);
    if (index < 0) return current;
    const remaining = current.tabs.filter(tab => tab.deviceId !== id);
    return { tabs: remaining, selected: current.selected === id
      ? (remaining[index] ?? remaining[index - 1])?.deviceId : current.selected };
  });
  const title = t('client.remoteDesktop.remoteDesktop');
  return <section className="rd-page" hidden={!active} aria-label={title}>
    {tabs.length ? <Tabs className="rd-computer-tabs" type="editable-card" hideAdd animated={false}
      locale={{ removeAriaLabel: t('client.projectBrowser.close') }}
      activeKey={selected} onChange={id => setWorkspace(current => ({ ...current, selected: id }))}
      onEdit={(id, action) => { if (action === 'remove' && typeof id === 'string') close(id); }}
      removeIcon={<X size={14} />} tabBarExtraContent={active && <AddDesktopMenu openDesktop={open}
        devices={devices.filter(device => !tabs.some(tab => tab.deviceId === device.deviceId))} />}
      items={tabs.map(tab => {
        const { deviceId } = tab;
        const name = devices.find(device => device.deviceId === deviceId)?.name ?? tab.name;
        return { key: deviceId, icon: <Monitor size={15} />, label: <span title={name}>{name}</span>,
          children: <ConnectedDesktop deviceId={deviceId} connect={connect} visible={active && selected === deviceId}
            localClipboard={localClipboard} close={() => close(deviceId)} /> };
      })} /> : <>
      <header className="rd-page-header"><Monitor size={21} aria-hidden="true" /><h1>{title}</h1></header>
      <DesktopDirectory devices={devices} directory={directory} login={login} open={open} />
    </>}
  </section>;
}

function DesktopDirectory({ devices, directory, login, open }: Pick<Props, 'devices' | 'directory' | 'login'> & {
  open: (device: ChatComputer) => void;
}) {
  const refresh = t('client.app.refreshDeviceList');
  return <div className="rd-page-directory">
    <div className="rd-page-directory-heading"><h2>{t('client.settings.chooseAComputer')}</h2>
      {!login && <Tooltip title={refresh}><Button aria-label={refresh} icon={<RefreshCw size={15} />}
        disabled={directory.loading} onClick={directory.refresh} /></Tooltip>}
    </div>
    {directory.error && <Alert type="warning" showIcon message={displayError(directory.error)} />}
    {devices.length > 0 ? <div className="rd-device-list">
      {devices.map(device => <button type="button" key={device.deviceId} disabled={!device.online}
        className="rd-device-card" onClick={() => open(device)}>
        <span className="rd-device-icon"><Monitor size={21} aria-hidden="true" /></span>
        <span className="rd-device-label"><strong>{device.name}</strong><small>{device.platform}</small></span>
        <span className="rd-device-presence">{t(device.online ? 'client.chat.online' : 'client.chat.offline')}</span>
        {device.online && <ChevronRight className="rd-device-open" size={16} aria-hidden="true" />}
      </button>)}
    </div> : <div className="rd-device-empty">
      {directory.loading ? <Spin /> : <><MonitorOff size={28} aria-hidden="true" />
        <p>{t(login ? 'client.app.pleaseSignInFirst' : 'client.mappingHub.noDevices')}</p>
        {login && <Button type="primary" onClick={login}>{t('client.lounge.login')}</Button>}</>}
    </div>}
  </div>;
}
