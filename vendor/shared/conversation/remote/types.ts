export type { ChatComputer as GuiComputer } from '../../remote-chat/devices';
import type { ChatComputer as GuiComputer } from '../../remote-chat/devices';
export interface GuiCloudIdentity { baseUrl: string; userId: string }
export interface GuiDeviceDirectory {
  identity: GuiCloudIdentity | null;
  currentDeviceId: string;
  currentDeviceName?: string | null;
  devices: GuiComputer[];
}
export interface GuiComputerNavigation {
  allowLocal?: boolean;
  current: GuiComputer | null;
  devices: GuiComputer[];
  authenticated: boolean;
  loading: boolean;
  error: string;
  refresh: () => void;
  choose: (device: GuiComputer | null) => void;
  login: () => void;
}
