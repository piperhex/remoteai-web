import type { MarketKey } from '../../provider-market/i18n';

export interface ViewportSize { width: number; height: number }
export interface DeviceSelection extends ViewportSize { name: string }
export interface DeviceViewport extends DeviceSelection { scale: number }

export const minDimension = 50;
export const maxDimension = 4096;
export const responsiveDevice = 'responsive';
export const initialDevice: DeviceSelection = { name: 'iPhone 16', width: 393, height: 852 };

// Default CSS viewport dimensions from Chrome DevTools' EmulatedDevices catalog.
export const deviceGroups: { label: MarketKey; devices: [name: string, width: number, height: number][] }[] = [
  { label: 'market.inspectorPhones', devices: [
    ['iPhone SE', 375, 667], [initialDevice.name, initialDevice.width, initialDevice.height],
    ['iPhone 16 Pro Max', 440, 956], ['Pixel 9', 412, 924], ['Pixel 9 Pro', 427, 952],
    ['Pixel 10', 412, 924], ['Samsung Galaxy A55', 360, 800],
  ] },
  { label: 'market.inspectorFoldables', devices: [
    ['Pixel 9 Pro Fold', 412, 922], ['Galaxy Z Fold 6', 412, 968],
  ] },
  { label: 'market.inspectorTablets', devices: [
    ['iPad Mini', 768, 1024], ['iPad Pro 13', 1032, 1376], ['Surface Pro 10', 960, 1440],
  ] },
  { label: 'market.inspectorDisplays', devices: [['Nest Hub Max', 1280, 800]] },
];
