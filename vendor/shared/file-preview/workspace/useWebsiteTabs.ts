import { useCallback, useContext, useRef, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { message } from 'antd';
import { createBrowserTab, moveTab, navigateTab, type BrowserAction, type BrowserTab }
  from '../../provider-market/browserState';
import { pageUrl } from '../../provider-market/pageLink';
import { browserMappings } from '../../port-mapping/browserMappings';
import type { BrowserSurfaceProps } from '../../provider-market/ProviderBrowser';
import { FileEnvironmentContext } from '../../conversation/fileEnvironment';
import { uiText } from '../../localization/uiText';
import type { ManagedBrowserTab } from '../../browser/automation';
import { BrowserClientContext } from './browserClient';
import { browserResourcePage, useBrowserResources, type BrowserResource } from './browserResources';
import { remainingBrowserTabs } from '../../provider-market/browserTabCommands';

interface BrowserState {
  tabs: BrowserTab[]; activeId: string; commands: Record<string, BrowserSurfaceProps['command']>;
}
const emptyState = (): BrowserState => ({ tabs: [], activeId: '', commands: {} });
function pageTitle(url: string) {
  const page = pageUrl(url);
  if (!page) return '';
  const name = page.pathname.split('/').filter(Boolean).at(-1);
  return name ? `${name} · ${page.hostname}` : page.hostname;
}

function visitResource(tab: BrowserTab, resource: BrowserResource): BrowserTab {
  if (tab.url === resource.url) return { ...tab, title: resource.title };
  const history = [...tab.history.slice(0, tab.historyIndex + 1), resource.url];
  return { ...tab, url: resource.url, title: resource.title, history, historyIndex: history.length - 1 };
}

/** Reserve tabs before resolving remote URLs, so rapid clicks cannot replace or reorder pages. */
export function useWebsiteTabs({ reuseTabs = true }: { reuseTabs?: boolean } = {}) {
  const environment = useContext(FileEnvironmentContext);
  const client = useContext(BrowserClientContext);
  const [state, setState] = useState<BrowserState>(emptyState);
  const { resources, clear: clearResources } = useBrowserResources();
  const sources = useRef(new Map<string, string>());
  const requests = useRef(new Map<string, symbol>());
  const sequence = useRef(0);
  const currentTabs = useRef(state.tabs); currentTabs.current = state.tabs;
  const managedCommand = useCallback((id: string, command: import('../../browser/automation').BrowserCommand) => {
    const tab = currentTabs.current.find(tab => tab.id === id);
    if (!tab?.automationThread) return false;
    void (tab.automationClient ?? client).request({ threadId: tab.automationThread, tabId: id, command })
      .catch(() => { void message.error({ content: uiText('market.browserFailed'),
        style: { maxWidth: 400, marginInline: 'auto' } }); });
    return true;
  }, [client]);
  const reset = useCallback(() => {
    sources.current.clear(); requests.current.clear(); clearResources(); setState(emptyState());
  }, [clearResources]);
  const pageNavigate = useCallback((id: string, url: string) => {
    const resource = browserResourcePage(resources.get(id), url);
    if (!resource && !pageUrl(url)) return;
    setState(current => ({ ...current, tabs: current.tabs.map(tab => {
      if (tab.id !== id) return tab;
      return resource ? visitResource(tab, resource) : { ...navigateTab(tab, url), title: pageTitle(url) };
    }) }));
  }, [resources]);
  const navigate = useCallback(async (id: string, url: string, options: {
    resolved?: boolean; resolve?: (url: string) => Promise<string>;
  } = {}) => {
    if (!pageUrl(url)) return;
    if (managedCommand(id, { action: 'navigate', url })) return;
    const request = Symbol(); requests.current.set(id, request);
    try {
      const resolve = options.resolve ?? environment?.resolveWebsite;
      const localMapping = browserMappings.matches(new URL(url));
      const address = resolve && !options.resolved && !localMapping ? await resolve(url) : url;
      if (requests.current.get(id) === request) pageNavigate(id, address);
    } catch {
      if (requests.current.get(id) === request) void message.error({
        content: uiText('client.conversation.couldNotOpenTheLinkPleaseTryAgainShortly'),
        style: { maxWidth: 400, marginInline: 'auto' },
      });
    } finally {
      if (requests.current.get(id) === request) requests.current.delete(id);
    }
  }, [environment, pageNavigate, managedCommand]);
  const add = useCallback((url = '', resolved = false, resolve?: (url: string) => Promise<string>) => {
    const tab = { ...createBrowserTab(), title: pageTitle(url) };
    setState(current => ({ ...current, tabs: [...current.tabs, tab], activeId: tab.id }));
    if (url) void navigate(tab.id, url, { resolved, resolve });
    return tab.id;
  }, [navigate]);
  const open = useCallback((url: string, resolved = false, resolve?: (url: string) => Promise<string>) => {
    if (!pageUrl(url)) return;
    const source = `${resolved}:${url}`;
    const existing = reuseTabs ? sources.current.get(source) : undefined;
    if (existing) { setState(current => ({ ...current, activeId: existing })); return; }
    sources.current.set(source, add(url, resolved, resolve));
  }, [add, reuseTabs]);
  const selectResource = useCallback((key: string) => {
    const entry = [...resources].find(([, resource]) => resource.key === key);
    if (!entry) return undefined;
    const [id, resource] = entry;
    requests.current.delete(id);
    setState(current => ({ ...current, activeId: id, tabs: current.tabs.map(tab => {
      if (tab.id !== id || tab.url === resource.url) return tab;
      const history = [...tab.history.slice(0, tab.historyIndex + 1), resource.url];
      return { ...tab, url: resource.url, title: resource.title, history, historyIndex: history.length - 1 };
    }) }));
    return resource.url;
  }, [resources]);
  const openResource = useCallback((resource: BrowserResource) => {
    if (reuseTabs && selectResource(resource.key)) {
      if (![...resources.values()].includes(resource)) resource.release?.();
      return;
    }
    const tab = { ...createBrowserTab(), title: resource.title, url: resource.url,
      history: [resource.url], historyIndex: 0 };
    resources.set(tab.id, resource);
    setState(current => ({ ...current, tabs: [...current.tabs, tab], activeId: tab.id }));
  }, [resources, selectResource, reuseTabs]);
  const removeTabs = useCallback((ids: string[]) => {
    const closed = new Set(ids);
    closed.forEach(id => {
      resources.get(id)?.release?.(); resources.delete(id); requests.current.delete(id);
    });
    sources.current.forEach((value, key) => { if (closed.has(value)) sources.current.delete(key); });
    setState(current => {
      const commands = { ...current.commands }; closed.forEach(id => { delete commands[id]; });
      return { ...remainingBrowserTabs(current.tabs, current.activeId, ids), commands };
    });
  }, [resources]);
  const remove = useCallback((id: string) => removeTabs([id]), [removeTabs]);
  const closeTabs = useCallback((ids: string[]) => {
    new Set(ids).forEach(id => managedCommand(id, { action: 'close' })); removeTabs(ids);
  }, [managedCommand, removeTabs]);
  const close = useCallback((id: string) => closeTabs([id]), [closeTabs]);
  const action = useCallback((id: string, action: BrowserAction) => {
    if (managedCommand(id, { action })) return;
    if ((!isTauri() || resources.has(id)) && (action === 'back' || action === 'forward')) {
      setState(current => ({ ...current, tabs: current.tabs.map(tab => {
        if (tab.id !== id) return tab;
        const next = moveTab(tab, action === 'back' ? -1 : 1);
        const resource = browserResourcePage(resources.get(id), next.url);
        return { ...next, title: resource?.title ?? pageTitle(next.url) };
      }) }));
      return;
    }
    const command = { action, sequence: ++sequence.current };
    setState(current => ({ ...current, commands: { ...current.commands, [id]: command } }));
  }, [managedCommand, resources]);
  const adopt = useCallback((tab: ManagedBrowserTab, owner = client) => {
    setState(current => ({ ...current, activeId: tab.id, tabs: current.tabs.some(entry => entry.id === tab.id)
      ? current.tabs : [...current.tabs, { ...createBrowserTab(), ...tab,
        title: pageTitle(tab.url), automationThread: tab.threadId, automationClient: owner }] }));
  }, [client]);
  return { ...state, open, reset, adopt, remove, resources, openResource, selectResource,
    onCloseTab: close, onCloseTabs: closeTabs, onNewTab: add,
    onSelect: (activeId: string) => setState(current => ({ ...current, activeId })),
    onNavigate: (id: string, url: string) => { void navigate(id, url); }, onPageNavigate: pageNavigate,
    onPopup: (_id: string, url: string) => { if (pageUrl(url)) add(url, true); }, onAction: action };
}
