import type { Page } from '@playwright/test';
import type { RemoteDevice } from '../src/types';

const COMPUTER = 'computer';
const LAPTOP = 'laptop';

export function computers(): RemoteDevice[] {
  return [
    { deviceId: 'offline', name: '离线电脑', online: false },
    { deviceId: COMPUTER, name: '我的工作电脑', online: true },
    { deviceId: LAPTOP, name: '另一台电脑', online: true },
  ].map((device) => ({ ...device, platform: 'Windows', capabilities: [],
    localProxyRunning: false, lastSeenAt: new Date().toISOString() }));
}

export async function provideComputers(page: Page, devices: () => RemoteDevice[]) {
  let publish = () => {};
  // The local chat fixture routes every device ID to the same emulated computer.
  await page.route('**/devices', (route) => route.fulfill({ json: { devices: devices() } }));
  await page.routeWebSocket('**/device-switch', (socket) => {
    publish = () => socket.send(JSON.stringify({ type: 'devices-snapshot', devices: devices() }));
    socket.onMessage(() => publish());
  });
  return () => publish();
}
