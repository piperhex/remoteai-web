import { useEffect, useRef, type KeyboardEvent } from 'react';

export function useBrowserSubmenuKeyboard(open: boolean, change: (open: boolean) => void) {
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const focusRequested = useRef(false);
  const focusFirst = () => menu.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
  useEffect(() => {
    if (!open || !focusRequested.current) return;
    const frame = requestAnimationFrame(() => { focusFirst(); focusRequested.current = false; });
    return () => cancelAnimationFrame(frame);
  }, [open]);
  const onTriggerKeyDown = (event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowDown', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    if (open) { focusFirst(); return; }
    focusRequested.current = true; change(true);
  };
  const onMenuKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'ArrowRight') {
      event.preventDefault(); event.stopPropagation(); change(false); trigger.current?.focus();
      return;
    }
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]:not(:disabled)') ?? [])];
    if (!items.length) return;
    const index = items.findIndex(item => item === menu.current?.ownerDocument.activeElement);
    const target = { ArrowDown: (index + 1) % items.length, ArrowUp: (index - 1 + items.length) % items.length,
      Home: 0, End: items.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault(); items[target]?.focus();
  };
  return { trigger, menu, onTriggerKeyDown, onMenuKeyDown };
}
