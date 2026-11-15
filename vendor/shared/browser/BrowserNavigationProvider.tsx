import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useWebsiteTabs } from '../file-preview/workspace/useWebsiteTabs';
import type { BrowserResource } from '../file-preview/workspace/browserResources';
import type { BrowserClient, ManagedBrowserTab } from './automation';
import { BrowserClientContext } from '../file-preview/workspace/browserClient';

export const BrowserNavigationContext = createContext<{
  browser: ReturnType<typeof useWebsiteTabs>;
  openWebsite: (url: string, options?: { resolved?: boolean; resolve?: (url: string) => Promise<string> }) => void;
  openResource: (resource: BrowserResource) => void;
  openManaged: (tab: ManagedBrowserTab, client: BrowserClient, reveal?: boolean) => void;
} | null>(null);

/** Application-owned tabs survive leaving a conversation and reserve a new tab for every preview click. */
export function BrowserNavigationProvider({ children, onOpen }: { children: ReactNode; onOpen: () => void }) {
  const browser = useWebsiteTabs({ reuseTabs: false });
  const client = useContext(BrowserClientContext);
  const clients = useMemo(() => [...new Set([client, ...browser.tabs
    .flatMap(tab => tab.automationClient ? [tab.automationClient] : [])])], [client, browser.tabs]);
  useEffect(() => {
    let disposed = false;
    const listeners = clients.map(owner => owner.subscribe(event => {
      if (!disposed && event.type === 'closed') browser.remove(event.tabId);
    }));
    listeners.forEach(listener => void listener.catch(error => console.debug('Standalone browser subscription unavailable', error)));
    return () => { disposed = true; listeners.forEach(listener => void listener.then(stop => stop()).catch(() => {})); };
  }, [clients, browser.remove]);
  const value = useMemo(() => ({ browser,
    openWebsite: (url: string, options?: { resolved?: boolean; resolve?: (url: string) => Promise<string> }) => {
      browser.open(url, options?.resolved, options?.resolve); onOpen();
    },
    openResource: (resource: BrowserResource) => { browser.openResource(resource); onOpen(); },
    openManaged: (tab: ManagedBrowserTab, owner: BrowserClient, reveal = true) => {
      browser.adopt(tab, owner); if (reveal) onOpen();
    },
  }), [browser, onOpen]);
  return <BrowserNavigationContext.Provider value={value}>{children}</BrowserNavigationContext.Provider>;
}
