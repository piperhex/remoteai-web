import { useLayoutEffect, useRef } from 'react';

function showAddressStart(input: HTMLInputElement | null) {
  if (!input) return;
  input.setSelectionRange(0, 0);
  input.scrollLeft = 0;
}

/** Keep the origin visible outside editing, including after redirects and tab changes. */
export function useBrowserAddressInput(address: string) {
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (document.activeElement !== ref.current) showAddressStart(ref.current);
  }, [address]);
  return { ref, onBlur: () => showAddressStart(ref.current) };
}
