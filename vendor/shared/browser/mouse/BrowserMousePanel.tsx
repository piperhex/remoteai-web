import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DesktopMouse } from '../../remote-desktop/views/MousePad';
import { documentMouse } from './documentMouse';
import { useBrowserMouse } from './useBrowserMouse';
import '../../remote-desktop/views/desktop.css';
import './browserMouse.css';

export function BrowserMousePanel({ home, active }: { home: boolean; active: boolean }) {
  const layer = useRef<HTMLDivElement>(null);
  const [surface, setSurface] = useState<HTMLElement>();
  const [size, setSize] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const send = useMemo(() => surface && documentMouse(surface.ownerDocument, surface), [surface]);
  const mouse = useBrowserMouse(size, send, !!surface && active);
  const { cancel } = mouse;
  useLayoutEffect(() => {
    const page = layer.current?.parentElement;
    const scope = page?.querySelector<HTMLElement>(home ? '.browser-home' : '.browser-tab-canvas');
    if (!active || !page || !scope) { setSurface(undefined); return; }
    const measure = () => {
      const { width, height, x, y } = page.getBoundingClientRect();
      if (width && height) setSize(before => before.width === width && before.height === height
        && before.x === x && before.y === y ? before : { width, height, x, y });
      // The browser prevents synthetic input in cross-origin frames. Leave those pages directly touchable.
      const frames = [...scope.querySelectorAll('iframe')].filter(frame => frame.getClientRects().length);
      setSurface(frames.some(frame => !frame.contentDocument) ? undefined : scope);
    };
    const observer = new ResizeObserver(measure); observer.observe(page);
    const changes = new MutationObserver(measure); changes.observe(scope, { childList: true, subtree: true });
    const load = (event: Event) => {
      if (event.target instanceof HTMLIFrameElement) { cancel(); measure(); }
    };
    scope.addEventListener('load', load, true); measure();
    return () => {
      cancel(); observer.disconnect(); changes.disconnect(); scope.removeEventListener('load', load, true);
    };
  }, [home, active, cancel]);
  const { x, y } = mouse.viewport.content;
  useLayoutEffect(() => {
    const page = surface?.parentElement;
    if (!page || !active) return;
    page.classList.add('browser-mouse-stage');
    surface.style.translate = `${x}px ${y}px`;
    return () => { surface.style.removeProperty('translate'); page.classList.remove('browser-mouse-stage'); };
  }, [surface, active, x, y]);
  useEffect(() => {
    if (!active) return;
    const blur = () => queueMicrotask(() => { if (!document.hasFocus()) cancel(); });
    window.addEventListener('blur', blur);
    return () => window.removeEventListener('blur', blur);
  }, [active, cancel]);
  return <div ref={layer} className="browser-mouse-layer">
    {active && surface && size.width > 0 && <DesktopMouse {...mouse} />}
  </div>;
}
