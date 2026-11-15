import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { DESKTOP_QUERY } from '../layout/useDesktopLayout';

const OVERLAYS = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], '
  + '.ant-popover, .ant-dropdown, .ant-drawer, .adm-popup, .chat-composer-popover';

function visible(element: HTMLElement) {
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
}

function ownsFocus(element: HTMLElement) {
  // Ant Design leaves closing overlays in the DOM until their exit animation completes.
  const closing = [...element.classList].some(name => /-leave(?:-active|-to)?$/.test(name));
  return !closing && visible(element);
}

function subscribeNativeFocus(resume: () => void, cancel: () => void) {
  let disposed = false;
  let unlisten: (() => void) | undefined;
  void import('@tauri-apps/api/window').then(({ getCurrentWindow }) =>
    getCurrentWindow().onFocusChanged(({ payload }) => {
      if (!disposed) { if (payload) resume(); else cancel(); }
    })).then(stop => {
    if (disposed) stop(); else unlisten = stop;
  }).catch(() => {
    // Browser focus events remain available when the native bridge is unavailable.
  });
  return () => { disposed = true; unlisten?.(); };
}

/** Focus only on entering the workspace or returning to the app, never on routine state updates. */
export function useComposerAutoFocus({ input, active, disabled, focus }: {
  input: RefObject<HTMLElement>; active: boolean; disabled: boolean; focus?: () => void;
}) {
  const native = '__TAURI_INTERNALS__' in window;
  const latest = useRef({ disabled, focus });
  latest.current = { disabled, focus };
  const pending = useRef(false);
  const frame = useRef<number>();
  const cancel = useCallback(() => {
    pending.current = false;
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
  }, []);
  const flush = useCallback(() => {
    if (!pending.current) return;
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (!native && !window.matchMedia?.(DESKTOP_QUERY).matches) { pending.current = false; return; }
      const node = input.current;
      if (!pending.current || latest.current.disabled || document.visibilityState === 'hidden'
        || !node?.isConnected || !visible(node)) return;
      pending.current = false;
      // An open dialog or picker owns its keyboard focus, including after app activation.
      if ([...document.querySelectorAll<HTMLElement>(OVERLAYS)].some(ownsFocus)) return;
      if (document.activeElement === node) return;
      if (latest.current.focus) latest.current.focus();
      else node.focus({ preventScroll: true });
    });
  }, [input, native]);
  useEffect(() => {
    if (!active) return;
    const resume = () => { pending.current = true; flush(); };
    const visibility = () => { if (document.visibilityState === 'hidden') cancel(); else resume(); };
    const interact = (event: Event) => {
      if (!input.current?.contains(event.target as Node)) cancel();
    };
    resume();
    window.addEventListener('focus', resume);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('pointerdown', interact);
    document.addEventListener('keydown', interact);
    const stopNative = native ? subscribeNativeFocus(resume, cancel) : undefined;
    return () => {
      cancel(); stopNative?.();
      window.removeEventListener('focus', resume);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('pointerdown', interact);
      document.removeEventListener('keydown', interact);
    };
  }, [active, native, input, cancel, flush]);
  // Connection/loading may finish after entry. Only complete an outstanding focus request.
  useEffect(() => { if (!disabled) flush(); }, [disabled, flush]);
}
