import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { BrowserTab } from '../../provider-market/browserState';
import { useBrowserData } from './context';
import { browserUrl, type Login } from './model';
import { newDataId, validateLogin } from './crypto';
import type { DataControls } from './clear';
import { usePasswordSuggestions } from './usePasswordSuggestions';

export function useBrowserRecords(options: {
  tabs: BrowserTab[]; activeId: string; active: boolean; closeTabs: (ids: string[]) => void;
}) {
  const { store, vault, random } = useBrowserData(), observed = useRef(new Map<string, { url: string; at: number }>());
  const recorded = useRef(new Map<string, string>());
  const [candidate, setCandidate] = useState<Login>();
  const desktop = isTauri(), closeCapture = useCallback(() => setCandidate(undefined), []);
  useEffect(() => {
    for (const tab of options.tabs) {
      const previous = observed.current.get(tab.id);
      if (!browserUrl(tab.url) || previous?.url === tab.url || tab.automationThread) continue;
      const at = Date.now(); observed.current.set(tab.id, { url: tab.url, at });
    }
    for (const id of observed.current.keys()) if (!options.tabs.some(tab => tab.id === id)) observed.current.delete(id);
  }, [options.tabs, store, random]);
  const recordVisit = useCallback((id: string, page: { url: string; title: string }) => {
    if (!browserUrl(page.url) || recorded.current.get(id) === page.url) return;
    recorded.current.set(id, page.url);
    try { store.visit({ id: newDataId(random), kind: 'visit', url: page.url, title: page.title.slice(0, 512), at: Date.now() }); }
    catch { /* The store exposes persistence failures in the browser data UI. */ }
  }, [store, random]);
  const active = options.tabs.find(tab => tab.id === options.activeId);
  const suggestions = usePasswordSuggestions(active, options.active);
  useEffect(() => {
    if (!desktop || !options.active || !active) return;
    const unlisten = listen<Login>(`browser-login-${active.id}`, event => {
      if (validateLogin(event.payload) && !vault.snapshot().entries.some(entry => entry.origin === event.payload.origin
        && entry.username === event.payload.username && entry.password === event.payload.password)) setCandidate(event.payload);
    }).catch(() => undefined);
    return () => { void unlisten.then(stop => stop?.()); };
  }, [desktop, options.active, active?.id, vault]);
  useEffect(() => {
    if (!desktop || !options.active || !active?.url.startsWith('https:') || active.automationThread) return;
    let stopped = false, busy = false;
    const capture = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const login = await invoke<unknown>('provider_browser_password', { id: active.id,
          request: { action: 'take' } });
        if (!stopped && validateLogin(login)) {
          const existing = vault.snapshot().entries.find(entry => entry.origin === login.origin
            && entry.username === login.username && entry.password === login.password);
          if (!existing) setCandidate(login);
        }
      } catch { /* Blank, closed or navigating pages have no login form to observe. */ }
      finally { busy = false; }
    };
    void capture();
    const timer = setInterval(() => void capture(), 2000);
    return () => { stopped = true; clearInterval(timer); };
  }, [desktop, options.active, active?.id, active?.url, vault]);
  const controls: DataControls = {
    tabs: options.tabs.map(tab => ({ id: tab.id, at: observed.current.get(tab.id)?.at ?? 0 })),
    closeTabs: options.closeTabs,
    clearSiteData: desktop ? request => invoke('provider_browser_clear_data', { request }) : undefined,
  };
  const fill = desktop && active && !active.automationThread ? async (login: Login, focusId?: string) => {
    const { origin, username, password } = login;
    const done = await invoke<boolean>('provider_browser_password', { id: active.id,
      request: { action: 'fill', login: { origin, username, password }, focusId } });
    if (!done) throw new Error('password-fill');
  } : undefined;
  return { controls, fill, candidate, closeCapture, recordVisit, ...suggestions };
}
