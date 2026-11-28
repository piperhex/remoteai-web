import { pageUrl, resolvedPageUrl, type ProviderMarketSource } from './pageLink';

export type BrowserDataPageKind = 'history' | 'passwords';
export interface BrowserDataPage { kind: BrowserDataPageKind; sourceId?: string }

export interface BrowserTab {
  id: string;
  title: string;
  url: string;
  headerOrigin: string;
  headers: Record<string, string>;
  history: string[];
  historyIndex: number;
  dataPage?: BrowserDataPage;
  /** Present only for conversation-owned tabs controlled by the built-in browser tools. */
  automationThread?: string;
  /** Preserve the owning computer when a conversation tab moves into the menu browser. */
  automationClient?: import('../browser/automation').BrowserClient;
}
export type BrowserAction = 'back' | 'forward' | 'reload' | 'stop';
export interface BrowserPageTitle { url: string; title: string }
export interface BrowserTabPage extends BrowserPageTitle { requested: string }

/** A readable iframe can navigate internally while its requested src stays the same. */
export function currentTabPage(tab: BrowserTab, page?: BrowserTabPage) {
  return page && (tab.url === page.requested || tab.url === page.url) ? page : undefined;
}

export function createBrowserTab(source?: { name: string; marketSource: ProviderMarketSource }): BrowserTab {
  const url = source ? resolvedPageUrl(source.marketSource.page) : '';
  return { id: crypto.randomUUID(), title: source?.name ?? '', url,
    headerOrigin: url ? new URL(url).origin : '', headers: { ...source?.marketSource.page.headers },
    history: url ? [url] : [], historyIndex: url ? 0 : -1 };
}

export function openBrowserDataTab(tabs: BrowserTab[], kind: BrowserDataPageKind, opener: string) {
  const existing = tabs.find(tab => tab.dataPage?.kind === kind);
  const source = tabs.find(tab => tab.id === opener && !tab.dataPage);
  const sourceId = kind === 'passwords' ? source?.id : undefined;
  if (existing) {
    return { activeId: existing.id, tabs: sourceId ? tabs.map(tab => tab.id === existing.id
      ? { ...tab, dataPage: { kind, sourceId } } : tab) : tabs };
  }
  const tab = { ...createBrowserTab(), dataPage: { kind, sourceId } };
  return { activeId: tab.id, tabs: [...tabs, tab] };
}

export function navigateTab(tab: BrowserTab, url: string): BrowserTab {
  if (!pageUrl(url) || tab.url === url) return tab;
  const history = [...tab.history.slice(0, tab.historyIndex + 1), url];
  return { ...tab, url, history, historyIndex: history.length - 1, dataPage: undefined };
}

export function moveTab(tab: BrowserTab, direction: -1 | 1): BrowserTab {
  const historyIndex = Math.max(0, Math.min(tab.history.length - 1, tab.historyIndex + direction));
  return { ...tab, historyIndex, url: tab.history[historyIndex] ?? '' };
}
