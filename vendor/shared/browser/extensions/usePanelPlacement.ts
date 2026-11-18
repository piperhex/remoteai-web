import { useEffect, useRef, useState, type RefObject } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { nativeSurfaceSession } from '../managed/nativeSurfaceSession';
import { useNativeBrowserPreview } from '../managed/useNativeBrowserPreview';
import { hasBrowserOverlay } from '../managed/browserOverlays';
import { remotePanelPreview } from './remotePanelPreview';
import { watchPanelLayout } from './watchPanelLayout';
import type { usePanelTransport } from './usePanelTransport';

interface Placement {
  visible: boolean; preservePreview: boolean; scale: number;
  bounds: { x: number; y: number; width: number; height: number };
}
function samePlacement(last: Placement, next: Placement) {
  return last.visible === next.visible && last.preservePreview === next.preservePreview && (!next.visible
    || last.scale === next.scale && last.bounds.x === next.bounds.x && last.bounds.y === next.bounds.y
    && last.bounds.width === next.bounds.width && last.bounds.height === next.bounds.height);
}

function nativePanel(element: HTMLElement, transport: ReturnType<typeof usePanelTransport>,
  preview: ReturnType<typeof useNativeBrowserPreview>['preview'], failed: () => void) {
  let unwatch: (() => void) | undefined;
  let bounds = { x: 0, y: 0, width: 380, height: 700 };
  const session = nativeSurfaceSession<Placement>({
    apply: ({ visible, bounds }) => invoke('browser_extension_panel_place',
      { request: { session: transport.session, visible, bounds } }),
    same: samePlacement, preview, failed,
    capture: async () => {
      const { result } = await transport.request({ action: 'capture' });
      if (!result?.image) throw new Error('Browser panel preview unavailable');
      return `data:${result.image.mimeType};base64,${result.image.data}`;
    },
  });
  const sync = () => {
    const rect = element.getBoundingClientRect();
    if (rect.width && rect.height) bounds = { x: Math.max(0, rect.x), y: Math.max(0, rect.y),
      width: rect.width, height: rect.height };
    const modal = hasBrowserOverlay(element);
    session.update({ visible: !!(rect.width && rect.height) && !modal,
      preservePreview: modal, bounds, scale: window.devicePixelRatio });
  };
  return {
    active(value: boolean) {
      if (value) { unwatch ??= watchPanelLayout(element, sync); return; }
      unwatch?.(); unwatch = undefined;
      session.update({ visible: false, preservePreview: false, bounds, scale: window.devicePixelRatio });
    },
    close() { unwatch?.(); void session.close(); },
  };
}

export function usePanelPlacement(host: RefObject<HTMLDivElement>, transport: ReturnType<typeof usePanelTransport>,
  active: boolean) {
  const state = useRef({ transport, active }); state.current = { transport, active };
  const refresh = useRef<() => void>();
  const [image, setImage] = useState(''), [failed, setFailed] = useState(false);
  const { preview, image: nativeImage } = useNativeBrowserPreview();
  useEffect(() => {
    if (!transport.ready || !host.current) return;
    const current = state.current.transport;
    const failure = () => setFailed(true);
    const panel = current.native ? nativePanel(host.current, current, preview, failure)
      : remotePanelPreview(host.current, current, value => { setImage(value); setFailed(false); }, failure);
    setFailed(false); setImage('');
    const sync = () => panel.active(state.current.active && !document.hidden);
    refresh.current = sync;
    document.addEventListener('visibilitychange', sync); sync();
    return () => {
      refresh.current = undefined; document.removeEventListener('visibilitychange', sync); panel.close();
    };
  }, [transport.session, transport.ready, transport.native, preview, host]);
  useEffect(() => { refresh.current?.(); }, [active]);
  return { image: transport.native ? nativeImage : image, failed };
}
