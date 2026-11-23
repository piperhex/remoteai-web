import { invoke } from '@tauri-apps/api/core';
import { popupRegions } from './popupRegions';

/** The native window covers only live popup regions; uncovered pixels retain native page input. */
export function trackPopupPlacement(popup: Window, failed: () => void) {
  let stopped = false, frame = 0, flight = false, pending = false, previous = '', focusRequested = false;
  let focusTarget: EventTarget | null = null;
  const sync = async () => {
    if (stopped || popup.closed) return;
    if (flight) { pending = true; return; }
    const regions = popupRegions(popup);
    if (!regions.length) focusTarget = null;
    const placement = { regions, scale: popup.devicePixelRatio };
    const signature = JSON.stringify(placement);
    if (signature === previous && !focusRequested) return;
    const target = focusRequested ? focusTarget : null;
    focusRequested = false;
    flight = true;
    try {
      if (signature !== previous) {
        await invoke('browser_overlay_place', { placement });
        previous = signature;
      }
      if (target && regions.length && !stopped && popup.document.activeElement === target) {
        await invoke('browser_overlay_focus');
      }
    }
    catch (error) { console.error('Browser popup placement failed', error); if (!stopped) failed(); }
    finally { flight = false; if (pending) { pending = false; schedule(); } }
  };
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { void sync(); }); };
  const focus = (event: FocusEvent) => {
    // WebView2 can emit focusin again on the same control after the native focus handoff.
    if (event.target === focusTarget) return;
    focusTarget = event.target;
    focusRequested = true;
    schedule();
  };
  const blur = () => {
    if (popup.document.activeElement !== focusTarget) focusTarget = null;
  };
  const observer = new MutationObserver(schedule);
  observer.observe(popup.document.body, { childList: true, subtree: true, attributes: true, characterData: true });
  const resize = new ResizeObserver(schedule); resize.observe(popup.document.body);
  window.addEventListener('resize', schedule);
  popup.document.addEventListener('transitionend', schedule, true);
  popup.document.addEventListener('animationend', schedule, true);
  popup.document.addEventListener('focusin', focus);
  popup.document.addEventListener('focusout', blur);
  return () => {
    stopped = true; cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
    window.removeEventListener('resize', schedule);
    popup.document.removeEventListener('transitionend', schedule, true);
    popup.document.removeEventListener('animationend', schedule, true);
    popup.document.removeEventListener('focusin', focus);
    popup.document.removeEventListener('focusout', blur);
  };
}
