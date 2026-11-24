import { useLayoutEffect, useRef } from 'react';
import type { PasswordFocus } from './passwordFocus';

const EDGE = 8;
const FIELD_GAP = 5;
const MIN_WIDTH = 260;
const MAX_WIDTH = 380;

export function usePasswordPopupPlacement(tabId: string, focus: PasswordFocus, overlay: HTMLElement | null) {
  const container = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const popup = container.current;
    if (!popup) return;
    const surface = document.getElementById(`page-${tabId}`)?.querySelector('.pm-browser-surface');
    const place = () => {
      const rect = surface?.getBoundingClientRect();
      const scale = rect ? rect.width / focus.viewport.width : 1;
      const left = (rect?.left ?? EDGE) + focus.bounds.x * scale;
      const fieldTop = (rect?.top ?? 0) + focus.bounds.y * scale;
      const fieldBottom = fieldTop + focus.bounds.height * scale;
      const fieldWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, focus.bounds.width * scale));
      popup.style.width = `${Math.min(fieldWidth, innerWidth - 2 * EDGE)}px`;
      const below = Math.max(0, innerHeight - EDGE - fieldBottom - FIELD_GAP);
      const above = Math.max(0, fieldTop - FIELD_GAP - EDGE);
      const upwards = popup.scrollHeight + 2 * popup.clientTop > below && above > below;
      popup.style.left = `${Math.max(EDGE, Math.min(left, innerWidth - popup.offsetWidth - EDGE))}px`;
      popup.style.top = upwards ? 'auto' : `${Math.max(EDGE, fieldBottom + FIELD_GAP)}px`;
      popup.style.bottom = upwards ? `${Math.max(EDGE, innerHeight - fieldTop + FIELD_GAP)}px` : 'auto';
      popup.style.maxHeight = `${Math.min(innerHeight - 2 * EDGE, upwards ? above : below)}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    if (popup.firstElementChild) observer.observe(popup.firstElementChild);
    if (surface) observer.observe(surface);
    window.addEventListener('resize', place);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); };
  }, [tabId, focus, overlay]);
  return container;
}
