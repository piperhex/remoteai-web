import { useState } from 'react';
import { Alert, Button, Modal, Spin } from 'antd';
import { displayText as t } from '../../localization/messages';
import { remoteErrorText } from '../../localization/errors';
import type { ComputerListRefresh } from '../../remote-chat/ComputerSearchBar';
import type { ChatComputer } from '../../remote-chat/devices';
import { ChatDevices } from '../../remote-chat/views/ChatDevices';
import { SshQuickConnectDialog } from '../SshQuickConnectDialog';
import type { SshProfile } from '../sshProfiles';
import type { TerminalInfo } from '../types';
import type { SshHost } from './useSshHosts';

export interface SshHostDirectory {
  devices: ChatComputer[];
  localDeviceId?: string;
  get: (id: string) => SshHost | undefined;
  request: (id: string) => void;
  refresh?: ComputerListRefresh;
}

export function SshLaunchDialog({ profile, directory, projectCwd, connected, close }: {
  profile: SshProfile; directory: SshHostDirectory; projectCwd: string;
  connected: (info: TerminalInfo, host: SshHost) => void; close: () => void;
}) {
  const [chosen, setChosen] = useState<ChatComputer>();
  const [connecting, setConnecting] = useState<SshHost>();
  if (connecting) return <SshQuickConnectDialog api={connecting.api.ssh!} profile={profile}
    projectCwd={projectCwd} connected={info => connected(info, connecting)} dispose={connecting.api.close} close={close} />;
  if (!chosen) return <ChatDevices devices={directory.devices} localDeviceId={directory.localDeviceId}
    refresh={directory.refresh} onClose={close}
    choose={id => {
      const device = directory.devices.find(entry => entry.deviceId === id && entry.online);
      if (device) { directory.request(id); setChosen(device); }
    }} />;
  const host = directory.get(chosen.deviceId);
  const online = directory.devices.some(device => device.deviceId === chosen.deviceId && device.online);
  if (online && host?.ready && host.api.ssh) {
    setConnecting(host);
    return null;
  }
  const error = online ? host?.error : t('client.chat.offline');
  return <Modal open centered width={400} title={chosen.name} onCancel={close}
    footer={<Button onClick={() => setChosen(undefined)}>{t('client.settings.chooseAComputer')}</Button>}>
    {error ? <Alert showIcon type="warning" message={remoteErrorText(error)} />
      : <div role="status"><Spin size="small" /> {t('client.workspaceActions.connectingToTheComputer')}</div>}
  </Modal>;
}
