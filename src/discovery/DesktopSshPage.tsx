import { useMemo, useState } from 'react';
import { Button } from 'antd';
import { ChevronDown } from 'lucide-react';
import { SshWorkspace } from '../../../../shared/terminal/workspace/SshWorkspace';
import { remoteTerminalApi } from '../../../../shared/remote-chat/terminalApi';
import { ChatDevices } from '../../../../shared/remote-chat/views/ChatDevices';
import type { GuiToolsClient } from '../../../../shared/remote-chat/guiTools';
import { t } from '../../../../shared/localization/browserClient';
import type { RemoteDevice } from '../types';

export default function DesktopSshPage({ client, active, connected, device, devices, chooseDevice, scope }: {
  client: GuiToolsClient['terminal']; active: boolean; connected: boolean; device?: RemoteDevice;
  devices: RemoteDevice[]; chooseDevice: (id: string) => void; scope: string;
}) {
  const api = useMemo(() => remoteTerminalApi(client), [client]);
  const [picking, setPicking] = useState(false);
  return <>
    <SshWorkspace api={api} active={active} available={connected} scope={scope} host={
      <Button type="text" aria-label={t('client.settings.chooseAComputer')} onClick={() => setPicking(true)}>
        {device ? t('client.discovery.sshViaComputer', { name: device.name }) : t('client.settings.chooseAComputer')}
        <ChevronDown size={14} />
      </Button>} />
    {active && picking && <ChatDevices devices={devices} onClose={() => setPicking(false)}
      choose={id => { setPicking(false); chooseDevice(id); }} />}
  </>;
}
