import { useCallback, useEffect, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { BrowserTab } from '../../provider-market/browserState';
import { useBrowserData } from './context';
import { loginOrigin } from './model';
import { isPasswordFocus, matchingPasswords, type PasswordFocus } from './passwordFocus';

export function usePasswordSuggestions(tab: BrowserTab | undefined, active: boolean) {
  const { vault } = useBrowserData(), [focus, setFocus] = useState<PasswordFocus>();
  const closeSuggestions = useCallback(() => setFocus(undefined), []);
  useEffect(() => {
    setFocus(undefined);
    if (!isTauri() || !active || !tab || tab.automationThread) return;
    let stopped = false, busy = false;
    const receive = (value: unknown) => {
      if (stopped || !isPasswordFocus(value) || value.origin !== loginOrigin(tab.url) || !vault.header()) return;
      const passwords = vault.snapshot();
      if (!passwords.unlocked || matchingPasswords(passwords.entries, value).length) setFocus(value);
    };
    const unlisten = listen<unknown>(`browser-login-focus-${tab.id}`, event => receive(event.payload))
      .catch(() => undefined);
    // Windows sends native focus events immediately; portable WebViews use the fixed event reader.
    const poll = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try { receive(await invoke('provider_browser_password', { id: tab.id, request: { action: 'takeFocus' } })); }
      catch { /* Closed or navigating pages have no input to suggest for. */ }
      finally { busy = false; }
    };
    const timer = navigator.userAgent.includes('Windows') ? undefined : setInterval(() => void poll(), 500);
    return () => {
      stopped = true; clearInterval(timer);
      void unlisten.then(stop => stop?.());
    };
  }, [tab?.id, tab?.url, tab?.automationThread, active, vault]);
  return { focus, closeSuggestions };
}
