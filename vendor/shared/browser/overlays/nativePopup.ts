import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { preparePopupDocument } from './popupDocument';
import { trackPopupPlacement } from './popupPlacement';

let container: HTMLElement | null = null;
let opening: Promise<void> | undefined;
const listeners = new Set<() => void>();
export const popupSnapshot = () => container;
export const subscribePopup = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function prepareNativePopup() {
  if (!isTauri() || !navigator.userAgent.includes('Windows') || opening) return;
  opening = open().catch(error => {
    console.error('Native browser popups unavailable', error);
    opening = undefined;
  });
}

async function open() {
  const ticket = await invoke<string | null>('browser_overlay_prepare');
  if (!ticket) return;
  const popup = window.open(ticket, 'remoteai-browser-overlay', 'popup');
  if (!popup) throw new Error('Browser popup unavailable');
  const cleanups: (() => void)[] = [];
  const dispose = () => {
    cleanups.splice(0).forEach(stop => stop());
    container = null;
    listeners.forEach(listener => listener());
    popup.close();
  };
  try {
    await waitForPopup(popup, ticket);
    cleanups.push(preparePopupDocument(popup), connectPopupEvents(popup));
    cleanups.push(trackPopupPlacement(popup, dispose));
    cleanups.push(await listen('browser-overlay-dismiss', () => {
      popup.document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      popup.document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      window.dispatchEvent(new Event('browser-popup-dismiss'));
    }));
    container = popup.document.body;
    listeners.forEach(listener => listener());
    window.addEventListener('pagehide', dispose, { once: true });
    cleanups.push(() => window.removeEventListener('pagehide', dispose));
  } catch (error) { dispose(); throw error; }
}

async function waitForPopup(popup: Window, ticket: string) {
  await new Promise<void>((resolve, reject) => {
    const started = performance.now();
    const ready = () => {
      if (popup.closed || performance.now() - started > 5000) { reject(new Error('Browser popup unavailable')); return; }
      if (popup.location.href === ticket && popup.document.readyState === 'complete') resolve();
      else setTimeout(ready, 20);
    };
    ready();
  });
}

function connectPopupEvents(popup: Window) {
  // rc-trigger observes its popup's window. Forward owner clicks with their original targets,
  // so clicking a toolbar trigger still toggles it and clicking elsewhere dismisses its menu.
  const forward = (event: MouseEvent) => {
    const forwarded = new MouseEvent(event.type, { bubbles: true, clientX: event.clientX, clientY: event.clientY });
    Object.defineProperty(forwarded, 'target', { value: event.target });
    Object.defineProperty(forwarded, 'composedPath', { value: () => event.composedPath() });
    popup.dispatchEvent(forwarded);
  };
  for (const type of ['pointerdown', 'mousedown', 'contextmenu'] as const) window.addEventListener(type, forward, true);
  return () => {
    for (const type of ['pointerdown', 'mousedown', 'contextmenu'] as const) window.removeEventListener(type, forward, true);
  };
}
