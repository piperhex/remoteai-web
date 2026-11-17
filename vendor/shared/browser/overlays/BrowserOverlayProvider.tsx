import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import { popupSnapshot, prepareNativePopup, subscribePopup } from './nativePopup';

const BrowserOverlayContext = createContext<HTMLElement | null>(null);
export const useBrowserOverlay = () => useContext(BrowserOverlayContext);

/** React portals preserve the owner's stores, theme and callbacks across the trusted native popup. */
export function BrowserOverlayProvider({ children }: { children: ReactNode }) {
  const container = useSyncExternalStore(subscribePopup, popupSnapshot, () => null);
  useEffect(prepareNativePopup, []);
  return <BrowserOverlayContext.Provider value={container}>
    <ConfigProvider getPopupContainer={container ? () => container : undefined}>{children}</ConfigProvider>
  </BrowserOverlayContext.Provider>;
}
