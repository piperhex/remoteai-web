import { invoke } from '@tauri-apps/api/core';

const SHADOW_MARGIN = 14;
const POPUPS = '.ant-popover,.ant-dropdown,.ant-select-dropdown,.ant-tooltip,.ant-modal-wrap,'
  + '.ant-modal-mask,.ant-drawer-mask,.ant-drawer-content-wrapper,[data-browser-popup]';

/** The native window covers only live popup regions; uncovered pixels retain native page input. */
export function trackPopupPlacement(popup: Window, failed: () => void) {
  let stopped = false, frame = 0, flight = false, pending = false, previous = '', focusRequested = false;
  const sync = async () => {
    if (stopped || popup.closed) return;
    if (flight) { pending = true; return; }
    const regions = [...popup.document.querySelectorAll<HTMLElement>(POPUPS)].flatMap(element => {
      const style = popup.getComputedStyle(element), rect = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || !rect.width || !rect.height) return [];
      const x = Math.max(0, rect.left - SHADOW_MARGIN), y = Math.max(0, rect.top - SHADOW_MARGIN);
      return [{ x, y, width: Math.max(0, Math.min(innerWidth, rect.right + SHADOW_MARGIN) - x),
        height: Math.max(0, Math.min(innerHeight, rect.bottom + SHADOW_MARGIN) - y) }];
    });
    const placement = { regions: regions.slice(0, 128), scale: devicePixelRatio };
    const signature = JSON.stringify(placement);
    if (signature === previous && !focusRequested) return;
    const focus = focusRequested; focusRequested = false;
    flight = true;
    try {
      await invoke('browser_overlay_place', { placement }); previous = signature;
      if (focus && regions.length && !stopped) await invoke('browser_overlay_focus');
    }
    catch (error) { console.error('Browser popup placement failed', error); if (!stopped) failed(); }
    finally { flight = false; if (pending) { pending = false; schedule(); } }
  };
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { void sync(); }); };
  const focus = () => { focusRequested = true; schedule(); };
  const observer = new MutationObserver(schedule);
  observer.observe(popup.document.body, { childList: true, subtree: true, attributes: true, characterData: true });
  const resize = new ResizeObserver(schedule); resize.observe(popup.document.body);
  window.addEventListener('resize', schedule);
  popup.document.addEventListener('transitionend', schedule, true);
  popup.document.addEventListener('animationend', schedule, true);
  popup.document.addEventListener('focusin', focus);
  return () => {
    stopped = true; cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
    window.removeEventListener('resize', schedule);
    popup.document.removeEventListener('transitionend', schedule, true);
    popup.document.removeEventListener('animationend', schedule, true);
    popup.document.removeEventListener('focusin', focus);
  };
}
