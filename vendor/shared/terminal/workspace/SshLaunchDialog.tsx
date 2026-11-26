import { useState } from 'react';
import { Alert, Button, Modal, Spin } from 'antd';
import { displayText as t } from '../../localization/messages';
import { remoteErrorText } from '../../localization/errors';
import type { ChatComputer } from '../../remote-chat/devices';
import { ComputerIdentity } from '../../remote-chat/ComputerIdentity';
import { SshComputerMenu } from './SshComputerMenu';
import { SshQuickConnectDialog } from '../SshQuickConnectDialog';
import type { SshProfile } from '../sshProfiles';
import type { TerminalInfo } from '../types';
import type { SshHost, SshHostDirectory } from './useSshHosts';
export type { SshHostDirectory } from './useSshHosts';

export function SshLaunchDialog({ profile, directory, chosen, choose, projectCwd, connected, close }: {
  profile: SshProfile; directory: SshHostDirectory; projectCwd: string;
  chosen: ChatComputer; choose: (device: ChatComputer) => void;
  connected: (info: TerminalInfo, host: SshHost) => void; close: () => void;
}) {
  const [connecting, setConnecting] = useState<SshHost>();
  if (connecting) return <SshQuickConnectDialog api={connecting.api.ssh!} profile={profile}
    projectCwd={projectCwd} connected={info => connected(info, connecting)} dispose={connecting.api.close} close={close} />;
  const host = directory.get(chosen.deviceId);
  const online = directory.devices.some(device => device.deviceId === chosen.deviceId && device.online);
  if (online && host?.ready && host.api.ssh) {
    setConnecting(host);
    return null;
  }
  const error = online ? host?.error : t('client.chat.offline');
  return <Modal open centered width={400} title={<ComputerIdentity name={chosen.name} device={chosen} />} onCancel={close}
    footer={<SshComputerMenu directory={directory} choose={choose}>
      <Button>{t('client.settings.chooseAComputer')}</Button>
    </SshComputerMenu>}>
    {error ? <Alert showIcon type="warning" message={remoteErrorText(error)} />
      : <div role="status"><Spin size="small" /> {t('client.workspaceActions.connectingToTheComputer')}</div>}
  </Modal>;
}
