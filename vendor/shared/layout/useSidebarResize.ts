import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";

const KEYBOARD_STEP = 16;

export interface SidebarSizing {
  storageKey: string;
  minimum: number;
  maximum?: number;
  minimumContent: number;
  defaultWidth: (available: number, viewport: number) => number;
}

function readWidth({ storageKey, minimum, maximum = Infinity }: SidebarSizing) {
  try {
    const value = Number(localStorage.getItem(storageKey));
    return Number.isFinite(value) && value >= minimum ? Math.min(maximum, value) : null;
  } catch { return null; }
}

function rememberWidth(key: string, width: number | null) {
  try {
    if (width === null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(width));
    window.dispatchEvent(new Event(key + "-changed"));
  } catch { /* Resizing still works when preferences cannot be saved. */ }
}

export function useSidebarResize(sidebar: RefObject<HTMLElement>, layoutSelector: string, sizing: SidebarSizing) {
  const [available, setAvailable] = useState<number | null>(null);
  const [viewport, setViewport] = useState(window.innerWidth);
  const [preferred, setPreferred] = useState(() => readWidth(sizing));
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const drag = useRef<{ pointer: number; x: number; width: number; target: HTMLDivElement }>();
  const space = available ?? viewport;
  const { minimum, minimumContent } = sizing;
  const maximum = Math.max(minimum, Math.min(sizing.maximum ?? Infinity, Math.floor(space - minimumContent)));
  const clamp = (value: number) => Math.min(maximum, Math.max(minimum, Math.round(value)));
  const width = clamp(dragWidth ?? preferred ?? sizing.defaultWidth(space, viewport));
  const dragging = dragWidth !== null;
  const cancel = useCallback(() => {
    const current = drag.current;
    drag.current = undefined;
    setDragWidth(null);
    if (current?.target.hasPointerCapture(current.pointer)) current.target.releasePointerCapture(current.pointer);
  }, []);

  useEffect(() => {
    const layout = sidebar.current?.closest(layoutSelector);
    if (!layout) return;
    const measure = () => {
      setAvailable(layout.getBoundingClientRect().width);
      setViewport(window.innerWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(layout);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [sidebar, layoutSelector]);

  useEffect(() => {
    const sync = () => setPreferred(readWidth(sizing));
    const event = sizing.storageKey + "-changed";
    window.addEventListener(event, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(event, sync); window.removeEventListener("storage", sync); };
  }, [sizing]);

  useEffect(() => {
    if (!dragging) return;
    const { cursor, userSelect } = document.body.style;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("blur", cancel);
    return () => {
      document.body.style.cursor = cursor;
      document.body.style.userSelect = userSelect;
      window.removeEventListener("blur", cancel);
    };
  }, [dragging, cancel]);

  useEffect(() => { if (available === 0) cancel(); }, [available, cancel]);

  const commit = (value: number | null) => { setPreferred(value); rememberWidth(sizing.storageKey, value); };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const values: Record<string, number> = { ArrowLeft: width - KEYBOARD_STEP, ArrowRight: width + KEYBOARD_STEP,
      Home: minimum, End: maximum };
    if (!(event.key in values)) return;
    event.preventDefault();
    commit(clamp(values[event.key]));
  };
  return { width, minimum, maximum, dragging, enabled: available !== null && available > 0, handle: {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || drag.current) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus();
      drag.current = { pointer: event.pointerId, x: event.clientX, width, target: event.currentTarget };
      setDragWidth(width);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (drag.current?.pointer === event.pointerId) {
        setDragWidth(clamp(drag.current.width + event.clientX - drag.current.x));
      }
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      if (drag.current?.pointer !== event.pointerId) return;
      commit(clamp(drag.current.width + event.clientX - drag.current.x));
      cancel();
    },
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
    onKeyDown: keyboard,
    onDoubleClick: () => { cancel(); commit(null); },
  } };
}
