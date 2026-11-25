import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { bookmarkInFolder, pageBookmark, type Bookmark, type BookmarkDragSource } from './model';
import type { BookmarkStore } from './store';

const DRAG_THRESHOLD = 6;
const FOLDER_EDGE = 0.25;
interface Drag {
  source: BookmarkDragSource; x: number; y: number; pointer: number; element: HTMLElement; moved: boolean;
}
type Target = { id: string; placement: 'before' | 'after' } | { id: string; placement: 'inside'; link: Bookmark };
type Axis = 'x' | 'y';
type Page = { id: string; url: string; title: string };

function dropTarget(drag: Drag, event: globalThis.PointerEvent, root: HTMLElement, options: {
  axis: Axis; entries: Bookmark[];
}): Target | undefined {
  const hit = root.ownerDocument.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-bookmark-id]');
  if (!hit || !root.contains(hit)) return;
  const target = options.entries.find(entry => entry.id === hit.dataset.bookmarkId);
  if (!target) return;
  const bounds = hit.getBoundingClientRect();
  const fraction = options.axis === 'x' ? (event.clientX - bounds.left) / bounds.width
    : (event.clientY - bounds.top) / bounds.height;
  const source = drag.source;
  const center = fraction >= FOLDER_EDGE && fraction <= 1 - FOLDER_EDGE;
  if (center || 'page' in source) {
    const link = bookmarkInFolder(options.entries, source, target);
    if (link) return { id: target.id, placement: 'inside', link };
  }
  if (!('bookmarkId' in source) || source.bookmarkId === target.id) return;
  const entry = options.entries.find(item => item.id === source.bookmarkId);
  if (entry?.parentId === target.parentId) return { id: target.id, placement: fraction > 0.5 ? 'after' : 'before' };
}

/** Pointer sorting also works in Windows WebViews where native file drag handlers own HTML drops. */
export function useBookmarkDrag(store: BookmarkStore, axis: Axis) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag>();
  const suppressClick = useRef(false);
  const [preview, setPreview] = useState<{ source: BookmarkDragSource; target?: Target }>();
  useEffect(() => {
    const view = root.current?.ownerDocument.defaultView ?? window;
    const resolve = (current: Drag, event: globalThis.PointerEvent) => root.current
      ? dropTarget(current, event, root.current, { axis, entries: store.snapshot().entries }) : undefined;
    const cancel = () => {
      const current = drag.current;
      drag.current = undefined;
      if (current?.element.hasPointerCapture(current.pointer)) current.element.releasePointerCapture(current.pointer);
      setPreview(undefined);
    };
    const move = (event: globalThis.PointerEvent) => {
      const current = drag.current;
      if (!current || current.pointer !== event.pointerId) return;
      if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_THRESHOLD) return;
      current.moved = true; suppressClick.current = true; event.preventDefault();
      current.element.setPointerCapture(current.pointer);
      setPreview({ source: current.source, target: resolve(current, event) });
    };
    const up = (event: globalThis.PointerEvent) => {
      const current = drag.current;
      if (!current || current.pointer !== event.pointerId) return;
      const target = current.moved && resolve(current, event);
      cancel();
      if (!target) return;
      if (target.placement === 'inside') store.save(target.link);
      else if ('bookmarkId' in current.source) {
        store.reorder(current.source.bookmarkId, target.id, target.placement === 'after');
      }
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    view.addEventListener('pointermove', move, { passive: false });
    view.addEventListener('pointerup', up); view.addEventListener('pointercancel', cancel);
    view.addEventListener('blur', cancel); view.addEventListener('keydown', key);
    view.addEventListener('contextmenu', cancel, true);
    return () => {
      view.removeEventListener('pointermove', move); view.removeEventListener('pointerup', up);
      view.removeEventListener('pointercancel', cancel); view.removeEventListener('blur', cancel);
      view.removeEventListener('keydown', key); view.removeEventListener('contextmenu', cancel, true);
      cancel();
    };
  }, [axis, store]);
  const start = (event: PointerEvent, tabs?: Page[]) => {
    suppressClick.current = false;
    if (!root.current || event.button !== 0 || !event.isPrimary) return;
    const hit = event.target as Element;
    const element = tabs ? hit.closest<HTMLElement>('[role=tab]')
      : hit.closest('[data-bookmark-drag]')?.closest<HTMLElement>('[data-bookmark-id]');
    if (!element) return;
    let source: BookmarkDragSource;
    if (tabs) {
      const id = element.closest<HTMLElement>('[data-path]')?.dataset.path;
      const tab = tabs.find(item => item.id === id);
      const page = tab && pageBookmark(tab, () => crypto.randomUUID());
      if (!page) return;
      source = { page };
    } else {
      if (!element.dataset.bookmarkId || !root.current.contains(element)) return;
      source = { bookmarkId: element.dataset.bookmarkId };
    }
    drag.current = { source, x: event.clientX, y: event.clientY, pointer: event.pointerId, element, moved: false };
  };
  const click = (event: MouseEvent) => {
    if (suppressClick.current && event.detail) { event.preventDefault(); event.stopPropagation(); }
  };
  return {
    dragging: !!preview,
    className: (id: string) => {
      if (preview && 'bookmarkId' in preview.source && preview.source.bookmarkId === id) return 'bookmark-dragging';
      return preview?.target?.id === id ? `bookmark-drop-${preview.target.placement}` : '';
    },
    tabHandlers: (tabs: Page[]) => ({ onPointerDownCapture: (event: PointerEvent) => start(event, tabs),
      onClickCapture: click }),
    handlers: { ref: root, onPointerDownCapture: (event: PointerEvent) => start(event),
      onDragStart: (event: React.DragEvent) => event.preventDefault(), onClickCapture: click },
  };
}
