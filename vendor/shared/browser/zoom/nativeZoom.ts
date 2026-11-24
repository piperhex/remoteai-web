import { createContext, useContext, useLayoutEffect } from 'react';
import type { ZoomStep } from './zoomLevel';

export type NativeZoomKind = 'provider' | 'conversation';
export type NativeZoomEvent = { zoomPercent?: number; zoomStep?: ZoomStep; zoomWheel?: boolean };
export const NativeZoomContext = createContext<{
  attach: (kind: NativeZoomKind | null) => void;
  receive: (event: NativeZoomEvent) => void;
} | null>(null);

export function useNativeZoom(kind: NativeZoomKind, enabled: boolean) {
  const controller = useContext(NativeZoomContext);
  const attach = controller?.attach;
  useLayoutEffect(() => {
    if (!enabled || !attach) return;
    attach(kind);
    return () => attach(null);
  }, [attach, kind, enabled]);
  return controller?.receive;
}
