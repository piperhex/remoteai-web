import { useEffect, useState } from 'react';
import type { BrowserAction } from '../provider-market/browserState';
import type { BrowserWindowProps } from '../provider-market/ProviderBrowser';

/** Home covers the retained page, preserving forms, resource previews and native iframe history. */
export function useMobileBrowserHome(browser: BrowserWindowProps, compact: boolean) {
  const [returns, setReturns] = useState<Record<string, 'back' | 'forward'>>({});
  useEffect(() => {
    setReturns(current => Object.fromEntries(Object.entries(current).filter(([id]) => browser.tabs.some(t => t.id === id))));
  }, [browser.tabs]);
  const isHome = (id: string) => {
    const tab = browser.tabs.find(tab => tab.id === id);
    return compact && !tab?.dataPage && (!tab?.url || !!returns[id]);
  };
  const leave = (id: string) => setReturns(current => {
    const next = { ...current }; delete next[id]; return next;
  });
  const show = (id: string, direction: 'back' | 'forward' = 'back') => {
    if (!isHome(id)) setReturns(current => ({ ...current, [id]: direction }));
    (document.activeElement as HTMLElement | null)?.blur();
  };
  const navigate = (id: string, url: string) => { leave(id); browser.onNavigate(id, url); };
  const action = (id: string, action: BrowserAction) => {
    if (!compact) { browser.onAction(id, action); return; }
    if (isHome(id)) {
      if (returns[id] === action) leave(id);
      else if (action === 'back') browser.onClose();
      return;
    }
    const tab = browser.tabs.find(tab => tab.id === id);
    if (action === 'back' && tab && tab.historyIndex <= 0) { show(id, 'forward'); return; }
    browser.onAction(id, action);
  };
  return { isHome, show, navigate, action };
}
