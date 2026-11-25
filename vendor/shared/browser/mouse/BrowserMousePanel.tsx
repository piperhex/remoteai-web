import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DesktopMouse } from '../../remote-desktop/views/MousePad';
import { documentMouse } from './documentMouse';
import { useBrowserMouse } from './useBrowserMouse';
import '../../remote-desktop/views/desktop.css';
import './browserMouse.css';

export function BrowserMousePanel({ home }: { home: boolean }) {
  const layer = useRef<HTMLDivElement>(null);
  const [surface, setSurface] = useState<HTMLElement>();
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const page = layer.current?.parentElement;
    const scope = page?.querySelector<HTMLElement>(home ? '.browser-home' : '.browser-tab-canvas');
    if (!page || !scope) return;
    const measure = () => {
      const { width, height } = page.getBoundingClientRect();
      setSize({ width, height });
      // The browser prevents synthetic input in cross-origin frames. Leave those pages directly touchable.
      const frames = [...scope.querySelectorAll('iframe')].filter(frame => frame.getClientRects().length);
      setSurface(frames.some(frame => !frame.contentDocument) ? undefined : scope);
    };
    const observer = new ResizeObserver(measure); observer.observe(page);
    const changes = new MutationObserver(measure); changes.observe(scope, { childList: true, subtree: true });
    scope.addEventListener('load', measure, true); measure();
    return () => { observer.disconnect(); changes.disconnect(); scope.removeEventListener('load', measure, true); };
  }, [home]);
  return <div ref={layer} className="browser-mouse-layer">
    {surface && size.width > 0 && <PageMouse surface={surface} size={size} />}
  </div>;
}

function PageMouse({ surface, size }: { surface: HTMLElement; size: { width: number; height: number } }) {
  const [send] = useState(() => documentMouse(surface.ownerDocument, surface));
  const mouse = useBrowserMouse(size, send);
  useEffect(() => {
    const cancel = () => queueMicrotask(() => {
      if (!document.hasFocus()) { send({ kind: 'cancel', ...mouse.pointer.getSnapshot() }); mouse.pointer.release(); }
    });
    window.addEventListener('blur', cancel);
    return () => window.removeEventListener('blur', cancel);
  }, [mouse.pointer, send]);
  return <DesktopMouse {...mouse} />;
}
