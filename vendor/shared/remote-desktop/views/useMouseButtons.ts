import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import type { DesktopPointer } from '../input';
import type { DesktopViewport } from '../geometry';
import type { MousePanelActivity } from '../useMousePanel';
import { useMouseButtons as useSharedMouseButtons } from '../useMouseButtons';

type Button = 'left' | 'right';
interface Press { id: number; x: number; y: number }

export function useMouseButtons(pointer: DesktopPointer, viewport: DesktopViewport, panel: MousePanelActivity,
  pageCanTakeFocus = false) {
  const buttons = useSharedMouseButtons(pointer);
  const presses = useRef<Partial<Record<Button, Press>>>({});
  const cancel = useCallback(() => {
    presses.current = {}; buttons.cancel(); panel.hold('left', false); panel.hold('right', false);
  }, [buttons.cancel, panel.hold]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancel(); };
    // Moving focus into an embedded page also blurs its parent window. Wait for focus to settle.
    const blur = pageCanTakeFocus ? () => queueMicrotask(() => { if (!document.hasFocus()) cancel(); }) : cancel;
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', hidden);
    return () => {
      cancel(); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', hidden);
    };
  }, [cancel, pageCanTakeFocus]);
  const move = (button: Button, event: PointerEvent<HTMLButtonElement>) => {
    const previous = presses.current[button];
    if (previous?.id !== event.pointerId) return;
    if (button === 'left') buttons.move(event.clientX - previous.x, event.clientY - previous.y, viewport);
    presses.current[button] = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const handlers = (button: Button) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || presses.current[button]) return;
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      presses.current[button] = { id: event.pointerId, x: event.clientX, y: event.clientY };
      panel.hold(button, true); buttons.down(button);
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => move(button, event),
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      if (presses.current[button]?.id !== event.pointerId) return;
      move(button, event); delete presses.current[button]; buttons.up(button); panel.hold(button, false);
    },
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => {
      if (presses.current[button]?.id === event.pointerId) cancel();
    },
    onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => {
      if (presses.current[button]?.id === event.pointerId) cancel();
    },
  });
  return { ...buttons, cancel, handlers };
}
