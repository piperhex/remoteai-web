import { useRef, type PointerEvent } from 'react';
import type { BrowserAction } from '../provider-market/browserState';

export function BrowserEdgeGestures({ action }: { action: (action: BrowserAction) => void }) {
  const start = useRef<{ x: number; y: number; time: number; pointer: number }>();
  const down = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!event.isPrimary) { start.current = undefined; return; }
    start.current = { x: event.clientX, y: event.clientY, time: Date.now(), pointer: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const up = (event: PointerEvent<HTMLDivElement>, edge: 'left' | 'right') => {
    event.stopPropagation();
    const origin = start.current; start.current = undefined;
    if (!origin || origin.pointer !== event.pointerId) return;
    const dx = event.clientX - origin.x; const dy = event.clientY - origin.y;
    if (Date.now() - origin.time > 800 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    if (edge === 'left' && dx >= 60) action('back');
    if (edge === 'right' && dx <= -60) action('back');
  };
  return <>{(['left', 'right'] as const).map(edge => <div key={edge} aria-hidden="true"
    className={`browser-gesture-edge browser-gesture-${edge}`} onPointerDown={down}
    onPointerMove={event => event.stopPropagation()} onPointerUp={event => up(event, edge)}
    onPointerCancel={() => { start.current = undefined; }} />)}</>;
}
