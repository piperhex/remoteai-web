import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { MarketText } from '../../provider-market/i18n';
import { maxDimension, minDimension, type ViewportSize } from './deviceViewport';

type Edge = 'right' | 'bottom' | 'corner';
interface DragOrigin extends ViewportSize { x: number; y: number; scale: number; pointer: number }
const clamp = (value: number) => Math.max(minDimension, Math.min(maxDimension, Math.round(value)));

export function ViewportHandles({ size, scale, resize, t }: {
  size: ViewportSize; scale: number; resize: (size: ViewportSize, scale: number) => void; t: MarketText;
}) {
  const origin = useRef<DragOrigin>();
  const start = (event: PointerEvent) => {
    if (event.button !== 0 || !scale || origin.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = { ...size, scale, x: event.clientX, y: event.clientY, pointer: event.pointerId };
  };
  const move = (edge: Edge, event: PointerEvent) => {
    const from = origin.current;
    if (!from || from.pointer !== event.pointerId) return;
    // The page is centered horizontally and anchored at the top of the stage.
    const dx = 2 * (event.clientX - from.x) / from.scale;
    const dy = (event.clientY - from.y) / from.scale;
    resize({ width: clamp(from.width + (edge === 'bottom' ? 0 : dx)),
      height: clamp(from.height + (edge === 'right' ? 0 : dy)) }, from.scale);
  };
  const end = (event: PointerEvent) => {
    if (origin.current?.pointer === event.pointerId) origin.current = undefined;
  };
  const keyboard = (edge: Edge, event: KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 1;
    const dx = edge === 'bottom' ? 0 : Number(event.key === 'ArrowRight') - Number(event.key === 'ArrowLeft');
    const dy = edge === 'right' ? 0 : Number(event.key === 'ArrowDown') - Number(event.key === 'ArrowUp');
    if (!dx && !dy) return;
    event.preventDefault();
    resize({ width: clamp(size.width + dx * step), height: clamp(size.height + dy * step) }, scale);
  };
  return <>{(['right', 'bottom', 'corner'] as const).map(edge => {
    const corner = edge === 'corner';
    const horizontal = edge === 'bottom';
    const axisLabel = horizontal ? 'market.inspectorHeight' : 'market.inspectorWidth';
    const label = t(corner ? 'market.inspectorResizeViewport' : axisLabel);
    return <div key={edge} className="browser-device-handle" data-edge={edge} tabIndex={0}
      role={corner ? 'group' : 'separator'} aria-label={label} title={label}
      aria-orientation={corner ? undefined : horizontal ? 'horizontal' : 'vertical'}
      aria-valuemin={corner ? undefined : minDimension} aria-valuemax={corner ? undefined : maxDimension}
      aria-valuenow={corner ? undefined : horizontal ? size.height : size.width}
      onPointerDown={start} onPointerMove={event => move(edge, event)} onPointerUp={end}
      onPointerCancel={end} onLostPointerCapture={end} onKeyDown={event => keyboard(edge, event)} />;
  })}</>;
}
