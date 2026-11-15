import { useEffect, useRef, useState, type RefObject } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { nativeSurfaceSession } from '../managed/nativeSurfaceSession';
import { useNativeBrowserPreview } from '../managed/useNativeBrowserPreview';
import { browserOverlayAttributes, hasBrowserOverlay } from '../managed/browserOverlays';
import type { usePanelTransport } from './usePanelTransport';

export function usePanelPlacement(host: RefObject<HTMLDivElement>, transport: ReturnType<typeof usePanelTransport>,
  active: boolean) {
  const state = useRef({ transport, active }); state.current = { transport, active };
  const refresh = useRef<() => void>();
  const [image, setImage] = useState(''), [failed, setFailed] = useState(false);
  const preview = useNativeBrowserPreview();
  useEffect(() => {
    if (!transport.ready || !host.current) return;
    const element = host.current;
    let stopped = false, timer: ReturnType<typeof setTimeout> | undefined;
    let size = { width: 380, height: 700 };
    const capture = async () => {
      const reply = await state.current.transport.request({ action: 'capture' });
      if (!reply.result?.image) throw new Error('Browser panel preview unavailable');
      return `data:${reply.result.image.mimeType};base64,${reply.result.image.data}`;
    };
    const placement = nativeSurfaceSession<{ visible: boolean; preservePreview: boolean;
      bounds: { x: number; y: number; width: number; height: number } }>({
      apply: request => invoke('browser_extension_panel_place', { request: { session: transport.session,
        visible: request.visible, bounds: request.bounds } }), capture, preview: preview.preview,
      failed: () => { if (!stopped) setFailed(true); },
    });
    const sync = () => {
      const bounds = element.getBoundingClientRect(), modal = hasBrowserOverlay(element);
      if (bounds.width && bounds.height) size = { width: bounds.width, height: bounds.height };
      if (transport.native) placement.update({ visible: state.current.active && !document.hidden && !modal
          && bounds.width > 0 && bounds.height > 0,
        preservePreview: !state.current.active || modal, bounds: { x: Math.max(0, bounds.x), y: Math.max(0, bounds.y),
          ...size } });
    };
    const read = async () => {
      try {
        const bounds = element.getBoundingClientRect();
        if (state.current.active && !document.hidden && bounds.width && bounds.height) {
          await state.current.transport.request({ action: 'resize', width: bounds.width, height: bounds.height });
          const value = await capture();
          if (!stopped) { setImage(value); setFailed(false); }
        }
      } catch { if (!stopped) setFailed(true); }
      finally { if (!stopped) timer = setTimeout(() => void read(), 700); }
    };
    refresh.current = sync;
    const resize = new ResizeObserver(sync); resize.observe(element);
    const overlays = new MutationObserver(sync);
    overlays.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: browserOverlayAttributes });
    window.addEventListener('resize', sync); window.addEventListener('scroll', sync, true);
    document.addEventListener('visibilitychange', sync);
    sync(); if (!transport.native) void read();
    return () => {
      stopped = true; clearTimeout(timer); refresh.current = undefined; resize.disconnect(); overlays.disconnect();
      window.removeEventListener('resize', sync); window.removeEventListener('scroll', sync, true);
      document.removeEventListener('visibilitychange', sync);
      void placement.close();
    };
  }, [transport.session, transport.ready, transport.native, preview.preview]);
  useEffect(() => { refresh.current?.(); }, [active]);
  return { image: transport.native ? preview.image : image, failed };
}
