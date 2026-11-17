import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import type { Bookmark } from './model';

const DRAG_THRESHOLD = 6;
interface Drag { id: string; x: number; y: number; pointer: number; element: HTMLElement; moved: boolean }
interface Target { id: string; after: boolean }

/** Pointer sorting also works in Windows WebViews where native file drag handlers own HTML drops. */
export function useBookmarkDrag(options: {
  entries: Bookmark[]; axis: 'x' | 'y'; reorder: (id: string, targetId: string, after: boolean) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag>();
  const target = useRef<Target>();
  const suppressClick = useRef(false);
  const latest = useRef(options); latest.current = options;
  const [preview, setPreview] = useState<{ source: string; target?: Target }>();
  useEffect(() => {
    const owner = root.current?.ownerDocument ?? document;
    const eventWindow = owner.defaultView ?? window;
    const finish = (cancelled: boolean) => {
      const current = drag.current;
      drag.current = undefined;
      if (current?.element.hasPointerCapture(current.pointer)) current.element.releasePointerCapture(current.pointer);
      if (current?.moved && target.current && !cancelled) {
        latest.current.reorder(current.id, target.current.id, target.current.after);
      }
      target.current = undefined; setPreview(undefined);
    };
    const move = (event: globalThis.PointerEvent) => {
      const current = drag.current;
      if (!current || current.pointer !== event.pointerId) return;
      if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_THRESHOLD) return;
      current.moved = true; suppressClick.current = true; event.preventDefault();
      current.element.setPointerCapture(current.pointer);
      const hit = owner.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-bookmark-id]');
      const source = latest.current.entries.find(entry => entry.id === current.id);
      const destination = latest.current.entries.find(entry => entry.id === hit?.dataset.bookmarkId);
      target.current = undefined;
      if (hit && root.current?.contains(hit) && source && destination && source.id !== destination.id
        && source.parentId === destination.parentId) {
        const bounds = hit.getBoundingClientRect();
        const after = latest.current.axis === 'x' ? event.clientX > bounds.left + bounds.width / 2
          : event.clientY > bounds.top + bounds.height / 2;
        target.current = { id: destination.id, after };
      }
      setPreview({ source: current.id, target: target.current });
    };
    const up = (event: globalThis.PointerEvent) => { if (drag.current?.pointer === event.pointerId) finish(false); };
    const cancel = () => finish(true);
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    eventWindow.addEventListener('pointermove', move, { passive: false });
    eventWindow.addEventListener('pointerup', up); eventWindow.addEventListener('pointercancel', cancel);
    eventWindow.addEventListener('blur', cancel); eventWindow.addEventListener('keydown', key);
    return () => {
      eventWindow.removeEventListener('pointermove', move); eventWindow.removeEventListener('pointerup', up);
      eventWindow.removeEventListener('pointercancel', cancel); eventWindow.removeEventListener('blur', cancel);
      eventWindow.removeEventListener('keydown', key);
      const current = drag.current;
      if (current?.element.hasPointerCapture(current.pointer)) current.element.releasePointerCapture(current.pointer);
    };
  }, []);
  const start = (event: PointerEvent<HTMLDivElement>) => {
    suppressClick.current = false;
    if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary) return;
    const handle = (event.target as Element).closest('[data-bookmark-drag]');
    const element = handle?.closest<HTMLElement>('[data-bookmark-id]');
    if (!element?.dataset.bookmarkId || !root.current?.contains(element)) return;
    drag.current = { id: element.dataset.bookmarkId, x: event.clientX, y: event.clientY,
      pointer: event.pointerId, element, moved: false };
  };
  return {
    dragging: !!preview,
    className: (id: string) => [preview?.source === id && 'bookmark-dragging', preview?.target?.id === id
      && (preview.target.after ? 'bookmark-drop-after' : 'bookmark-drop-before')].filter(Boolean).join(' '),
    handlers: { ref: root, onPointerDownCapture: start, onDragStart: (event: React.DragEvent) => event.preventDefault(),
      onClickCapture: (event: MouseEvent) => {
        if (suppressClick.current && event.detail) { event.preventDefault(); event.stopPropagation(); }
      } },
  };
}
