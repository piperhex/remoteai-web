// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { fetchRemoteDevices, parseDeviceStatusMessage, setActiveSession } from '../api';

afterEach(() => {
  setActiveSession(null);
  vi.unstubAllGlobals();
});

it('keeps the same display capabilities through refresh, subscription and reconnection', async () => {
  const capabilities = ['screen-power', 'screen-power-status'];
  const device = { deviceId: 'pc', name: 'PC', platform: 'Windows', online: true,
    lastSeenAt: '2026-10-23T00:00:00Z', capabilities: [...capabilities, 'unrecognized', null] };
  setActiveSession({ baseUrl: 'https://example.test', email: 'test@example.test',
    accessToken: 'test', refreshToken: 'test' });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ devices: [device] }))));

  const devices = await fetchRemoteDevices();
  expect(devices[0].capabilities).toEqual(capabilities);
  expect(parseDeviceStatusMessage(JSON.stringify({ type: 'devices-snapshot', devices: [device] })))
    .toEqual({ type: 'devices-snapshot', devices });
  expect(parseDeviceStatusMessage(JSON.stringify({ type: 'device-online', device })))
    .toEqual({ type: 'device-online', device: devices[0] });
});
