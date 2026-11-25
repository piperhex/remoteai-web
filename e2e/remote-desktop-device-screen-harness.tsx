import { Provider } from 'react-redux';
import { useState } from 'react';
import { ChatTools } from '../src/chat/ChatTools';
import { client } from './remote-desktop-fixture';
import { DeviceManagementList } from '../src/devices/DeviceManagementList';
import { useDeviceScreenControl } from '../src/devices/useDeviceScreenControl';
import { parseDeviceStatusMessage, setActiveSession } from '../src/api';
import { store } from '../src/store';
import type { RemoteDevice } from '../src/types';

const reportedDevices: RemoteDevice[] = [
  { deviceId: 'computer', name: '工作电脑', platform: 'Windows', online: true },
  { deviceId: 'offline', name: '离线电脑', platform: 'Windows', online: false },
  { deviceId: 'mac', name: 'Mac', platform: 'macOS', online: true },
  { deviceId: 'legacy', name: '旧版电脑', platform: 'Windows', online: true },
].map(device => ({ ...device, capabilities: device.deviceId === 'legacy'
  ? ['screen-power'] : ['screen-power', 'screen-power-status'], localProxyRunning: false,
  lastSeenAt: '2026-10-23T00:00:00Z' }));
const snapshot = parseDeviceStatusMessage(JSON.stringify({ type: 'devices-snapshot', devices: reportedDevices }));
if (snapshot?.type !== 'devices-snapshot') throw new Error('Invalid device screen fixture');
const devices = snapshot.devices;

function Devices() {
  const screenControl = useDeviceScreenControl();
  const [desktopDeviceId, setDesktopDeviceId] = useState<string>();
  return <><DeviceManagementList devices={devices} accounts={[]} providers={[]} refreshing={false}
    onOpenDesktop={setDesktopDeviceId}
    onBack={() => {}}
    deletingDeviceId={null} switchingModelDeviceId={null} switchingAuthDeviceId={null}
    onRefresh={async () => {}} onSwitchModel={() => {}} onSelectAuthAccount={() => {}}
    onDelete={() => {}} onRevokeService={() => {}} screenControl={screenControl} />
    <div hidden><ChatTools client={client} cwd="" active={false} connected
      closeDeviceDesktop={desktopDeviceId === 'computer' ? () => setDesktopDeviceId(undefined) : undefined} /></div>
  </>;
}

export function DeviceScreenHarness() {
  setActiveSession({ baseUrl: location.origin, email: 'screen@example.test',
    accessToken: 'fixture', refreshToken: 'fixture' });
  return <Provider store={store}><main><Devices /></main></Provider>;
}
