import { useCallback, useEffect, useRef, useState, type HTMLAttributes } from 'react';

const OPEN_DELAY = 420;
const LEAVE_DELAY = 140;
const tabAt = (node: EventTarget | null) =>
  node instanceof Element ? node.closest<HTMLElement>('.pm-browser-tab') : null;

export function useBrowserTabHover(enabled: boolean) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const cancel = useCallback(() => clearTimeout(timer.current), []);
  const dismiss = useCallback(() => { cancel(); setAnchor(null); }, [cancel]);
  const leave = () => { cancel(); timer.current = setTimeout(dismiss, LEAVE_DELAY); };
  const enter = (tab: HTMLElement | null) => {
    cancel();
    if (!enabled || !tab) return;
    if (anchor) setAnchor(tab);
    else timer.current = setTimeout(() => setAnchor(tab), OPEN_DELAY);
  };
  useEffect(() => {
    if (!enabled) { dismiss(); return; }
    window.addEventListener('blur', dismiss);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('pointerdown', dismiss, true);
    window.addEventListener('browser-popup-dismiss', dismiss);
    return () => {
      cancel();
      window.removeEventListener('blur', dismiss);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('pointerdown', dismiss, true);
      window.removeEventListener('browser-popup-dismiss', dismiss);
    };
  }, [enabled, cancel, dismiss]);
  useEffect(() => {
    if (!enabled || !anchor) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); dismiss();
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [enabled, anchor, dismiss]);
  const events: HTMLAttributes<HTMLDivElement> = {
    onPointerOver: event => {
      const target = tabAt(event.target);
      if (event.pointerType === 'mouse' && target !== tabAt(event.relatedTarget)) enter(target);
    },
    onPointerOut: event => { if (tabAt(event.target) !== tabAt(event.relatedTarget)) leave(); },
    onFocus: event => { if (event.target.matches('[role=tab]:focus-visible')) enter(tabAt(event.target)); },
    onBlur: dismiss,
    onKeyDown: event => { if (event.key === 'Escape') dismiss(); },
  };
  return { anchor: enabled ? anchor : null, events, cancel, leave, dismiss };
}
