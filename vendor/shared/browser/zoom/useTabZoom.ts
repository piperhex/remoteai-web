import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { type NativeZoomEvent, type NativeZoomKind } from './nativeZoom';
import { defaultZoom, nextZoom, zoomHintDuration, type ZoomStep } from './zoomLevel';

export function useTabZoom(id: string, active: boolean) {
  const [kind, attach] = useState<NativeZoomKind | null>(null);
  const [page, setPage] = useState(defaultZoom);
  const [native, setNative] = useState(defaultZoom);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback(() => {
    setVisible(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), zoomHintDuration);
  }, []);
  useLayoutEffect(() => {
    setVisible(false);
    return () => clearTimeout(timer.current);
  }, [active, kind]);

  const requested = useRef(defaultZoom);
  const writing = useRef(Promise.resolve());
  useEffect(() => { requested.current = defaultZoom; setNative(defaultZoom); }, [kind]);
  const change = (step: ZoomStep) => {
    if (!active) return;
    show();
    if (!kind) { setPage(current => nextZoom(current, step)); return; }
    const percent = nextZoom(requested.current, step);
    requested.current = percent;
    // WebView2 reports user zoom gestures, but does not send ZoomFactorChanged for SetZoomFactor.
    writing.current = writing.current.then(async () => {
      await invoke('browser_set_zoom', { id, kind, percent });
      setNative(percent);
    }).catch(error => {
      if (requested.current === percent) requested.current = latest.current.native;
      console.debug('Browser zoom unavailable', error);
    });
  };
  const latest = useRef({ active, change, native });
  latest.current = { active, change, native };
  const receive = useCallback(({ zoomPercent, zoomStep, zoomWheel }: NativeZoomEvent) => {
    if (zoomPercent !== undefined && Number.isFinite(zoomPercent) && zoomPercent > 0) {
      requested.current = zoomPercent;
      setNative(zoomPercent);
      if (latest.current.active) show();
    } else if (zoomStep === -1 || zoomStep === 1) latest.current.change(zoomStep);
    else if (zoomWheel && latest.current.active) show();
  }, [show]);
  const step = useCallback((direction: ZoomStep) => latest.current.change(direction), []);
  return { attach, receive, kind, percent: kind ? native : page, visible: active && visible, show, step };
}
