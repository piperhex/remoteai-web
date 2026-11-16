import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { browserOverlayAttributes, hasBrowserOverlay } from './browserOverlays';
import { inspectorCommand, inspectorSession, type InspectorDock, type InspectorTarget } from './inspectorSession';

export function useInspector({ id, kind, enabled, active }: InspectorTarget & { enabled: boolean; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [dock, setDock] = useState<InspectorDock>('right');
  const [failed, setFailed] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const refresh = useRef<() => void>();
  const current = useRef({ active, dock }); current.current = { active, dock };
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let received = false;
    const listener = listen<{ label: string; open: boolean }>('browser-inspector', ({ payload }) => {
      if (stopped || payload.label !== `${kind}-browser-${id}`) return;
      received = true; setOpen(payload.open); setFailed(false);
      if (!payload.open) setDock('right');
    });
    // Managed tabs can keep their inspector while the conversation surface unmounts.
    void listener.then(() => inspectorCommand({ id, kind }, { action: 'status' })).then(value => {
      if (!stopped && !received) setOpen(value);
    }).catch(() => { /* A new native tab may not have been created yet; its open event is authoritative. */ });
    return () => { stopped = true; void listener.then(stop => stop()).catch(() => {}); };
  }, [enabled, id, kind]);
  useEffect(() => {
    if (!enabled || !open || !host.current) return;
    const element = host.current;
    const session = inspectorSession({ id, kind }, () => setFailed(true));
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = element.getBoundingClientRect();
        const { active, dock } = current.current;
        const visible = active && !document.hidden && !hasBrowserOverlay(element)
          && element.getClientRects().length > 0;
        session.update({ action: 'place', dock, visible, bounds: {
          x: Math.max(0, bounds.x), y: Math.max(0, bounds.y),
          width: Math.max(1, bounds.width), height: Math.max(1, bounds.height),
        } }, window.devicePixelRatio);
      });
    };
    refresh.current = sync;
    const observer = new ResizeObserver(sync); observer.observe(element);
    const overlays = new MutationObserver(sync);
    overlays.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: browserOverlayAttributes });
    window.addEventListener('resize', sync); window.addEventListener('scroll', sync, true);
    document.addEventListener('visibilitychange', sync); sync();
    return () => {
      cancelAnimationFrame(frame); refresh.current = undefined;
      observer.disconnect(); overlays.disconnect();
      window.removeEventListener('resize', sync); window.removeEventListener('scroll', sync, true);
      document.removeEventListener('visibilitychange', sync);
      void session.stop().catch(error => console.debug('Inspector surface already closed', error));
    };
  }, [enabled, open, id, kind]);
  useEffect(() => { refresh.current?.(); }, [active, dock]);
  const close = () => {
    void inspectorCommand({ id, kind }, { action: 'close' }).then(() => { setOpen(false); setDock('right'); })
      .catch(() => setFailed(true));
  };
  return { open: enabled && open, dock, setDock, failed, close, host };
}
