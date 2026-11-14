import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, ExternalLink,
  History, KeyRound, Maximize2, Minimize2, Plus, RotateCw, X } from 'lucide-react';
import { marketText, type MarketText } from './i18n';
import type { Language } from '@remoteai/i18n';
import { browserInput } from '../browser/addressInput';
import { useSearchEngine } from '../browser/useSearchEngine';
import { BrowserSearchSetting } from '../browser/BrowserSearchSetting';
import type { SearchEngine } from '../browser/searchEngine';
import type { BrowserAction, BrowserTab } from './browserState';
import { BrowserTabs } from './BrowserTabs';
import { BrowserWebsiteIcon } from '../browser/icons/BrowserWebsiteIcon';
import { useBrowserBookmarks } from '../browser/bookmarks/useBrowserBookmarks';
import './providerBrowser.css';
import '../browser/browserChrome.css';
import { isTauri } from '@tauri-apps/api/core';
import { useCompactBrowser } from '../browser/bookmarks/useCompactBrowser';
import { MobileBrowserToolbar, MobileTabManagerToolbar } from '../browser/MobileBrowserToolbar';
import { BrowserPages } from '../browser/BrowserPages';
import { BrowserSiteModeSetting } from '../browser/BrowserSiteModeSetting';
import { uiText } from '../localization/uiText';
import { useMobileBrowserHome } from '../browser/useMobileBrowserHome';
import { BrowserPortMappings, BrowserPortMappingsSetting } from '../browser/BrowserPortMappings';
import { bookmarkUrl } from '../browser/bookmarks/model';
import { openWebsiteInBrowser } from '../conversation/WebsiteLinkMenu';
import { BrowserSettingsAction } from '../browser/BrowserSettings';
import { BrowserHistory } from '../browser/data/BrowserDataPanel';
import { PasswordManager } from '../browser/data/PasswordManager';
import { PasswordSuggestions } from '../browser/data/PasswordSuggestions';
import { PasswordCapture } from '../browser/data/PasswordCapture';
import { useBrowserRecords } from '../browser/data/useBrowserRecords';
import { BrowserFullscreenControl } from '../browser/BrowserFullscreenControl';
import { BrowserExtensions } from '../browser/extensions/BrowserExtensions';

export interface BrowserSurfaceProps {
  tab: BrowserTab; active: boolean; command: { sequence: number; action: BrowserAction } | null;
  onNavigate: (url: string) => void; t: MarketText;
  onPopup: (url: string) => void;
  onLoadingChange?: (loading: boolean) => void;
  onVisit?: (page: { url: string; title: string }) => void;
  hideForModal?: boolean;
  obscured?: boolean;
}
export interface BrowserWindowProps {
  title?: string;
  open: boolean; tabs: BrowserTab[]; activeId: string; language: Language;
  onSelect: (id: string) => void; onCloseTab: (id: string) => void; onNewTab: () => void; onClose: () => void;
  onCloseTabs: (ids: string[]) => void;
  onNavigate: (id: string, url: string) => void; onAction: (id: string, action: BrowserAction) => void;
  onPopup: (id: string, url: string) => void;
  commands: Record<string, BrowserSurfaceProps['command']>; Surface: ComponentType<BrowserSurfaceProps>;
}

function BrowserToolbar({ tab, loading, fullscreen, toggleFullscreen, navigate, action, t, actions, star, settings,
  searchEngine }: {
  loading: boolean;
  tab?: BrowserTab; fullscreen: boolean; toggleFullscreen: () => void;
  navigate: (url: string) => void; action: (action: BrowserAction) => void; t: MarketText; actions?: ReactNode;
  star?: ReactNode; settings?: ReactNode;
  searchEngine: SearchEngine;
}) {
  const [address, setAddress] = useState(tab?.url ?? '');
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setAddress(tab?.url ?? ''); setInvalid(false); }, [tab?.id, tab?.url]);
  return <div className="pm-browser-toolbar">
    <button aria-label={t('market.browserBack')} title={t('market.browserBack')}
      disabled={!tab?.url} onClick={() => action('back')}><ArrowLeft size={17} /></button>
    <button aria-label={t('market.browserForward')} title={t('market.browserForward')}
      disabled={!tab?.url} onClick={() => action('forward')}><ArrowRight size={17} /></button>
    <button aria-label={t(loading ? 'market.cancel' : 'market.browserReload')}
      title={t(loading ? 'market.cancel' : 'market.browserReload')}
      disabled={!tab?.url} onClick={() => action(loading ? 'stop' : 'reload')}>
      {loading ? <X size={17} /> : <RotateCw size={17} />}</button>
    <form onSubmit={(event) => {
      event.preventDefault();
      if (tab?.url.startsWith('file:') && address.trim() === tab.url) {
        setInvalid(false); action('reload'); return;
      }
      const url = browserInput(address, searchEngine);
      setInvalid(!url);
      if (url) { setAddress(url.href); navigate(url.href); }
    }}>
      <BrowserWebsiteIcon url={tab?.url} size={15} />
      <input aria-label={t('market.browserAddress')} aria-invalid={invalid}
        value={address} onChange={(event) => { setAddress(event.target.value); setInvalid(false); }}
        placeholder={t('market.browserSearchOrAddress')} spellCheck={false} autoComplete="off" />
      {star}<button type="submit" aria-label={t('market.visitPage')}><ArrowRight size={16} /></button>
    </form>
    {actions}
    <button aria-label={t(fullscreen ? 'market.browserRestore' : 'market.browserFullscreen')}
      title={t(fullscreen ? 'market.browserRestore' : 'market.browserFullscreen')} onClick={toggleFullscreen}>
      {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
    {settings}
    {invalid && <span className="pm-browser-address-error" role="alert">{t('market.browserInvalidUrl')}</span>}
  </div>;
}

/** Browser chrome shared by the Provider dialog and the conversation sidebar. */
export function BrowserContents(props: BrowserWindowProps & {
  fullscreen: boolean; toggleFullscreen: () => void; embedded?: boolean; actions?: ReactNode;
  mainBrowser?: boolean;
  onPageNavigate?: (id: string, url: string) => void; history?: ReactNode;
}) {
  const { tabs, activeId, open } = props;
  const t = marketText(props.language);
  const tab = tabs.find((entry) => entry.id === activeId);
  const search = useSearchEngine();
  const narrow = useCompactBrowser();
  const compact = narrow && !isTauri();
  const mobileFullscreen = compact && props.fullscreen;
  const home = useMobileBrowserHome(props, compact);
  const displayTab = tab && home.isHome(tab.id) ? { ...tab, url: '', title: '' } : tab;
  const [manager, setManager] = useState(false);
  const [query, setQuery] = useState('');
  const [desktopTabs, setDesktopTabs] = useState<Record<string, boolean>>({});
  const [mappingsOpen, setMappingsOpen] = useState(false);
  const [dataPanel, setDataPanel] = useState<'history' | 'passwords'>();
  const [extensionsOpen, setExtensionsOpen] = useState(false);
  const externalUrl = bookmarkUrl(displayTab?.url ?? '');
  const showManager = compact && manager;
  const add = () => { props.onNewTab(); setManager(false); setQuery(''); };
  const closeTabs = (ids: string[]) => {
    if (tabs.every(tab => ids.includes(tab.id))) { setManager(false); setQuery(''); }
    props.onCloseTabs(ids);
  };
  const records = useBrowserRecords({ tabs, activeId, active: open, closeTabs });
  useEffect(() => { if (!open) setDataPanel(undefined); }, [open]);
  useEffect(() => { if (!open) { setManager(false); setMappingsOpen(false); } }, [open]);
  useEffect(() => {
    if (!compact || !open) return;
    const previous = document.documentElement.style.overscrollBehaviorX;
    document.documentElement.style.overscrollBehaviorX = 'none';
    return () => { document.documentElement.style.overscrollBehaviorX = previous; };
  }, [compact, open]);
  const bookmarks = useBrowserBookmarks({ tab: displayTab, t,
    settingsContent: dismiss => <>
      {(compact || props.mainBrowser) && <BrowserSiteModeSetting desktop={!compact || !!desktopTabs[activeId]} t={t}
        disabled={!compact}
        change={desktop => setDesktopTabs(current => ({ ...current, [activeId]: desktop }))} />}
      {compact && <BrowserSettingsAction icon={Maximize2} onClick={() => {
        dismiss(); props.toggleFullscreen();
      }}>{t('market.browserFullscreen')}</BrowserSettingsAction>}
      {(compact || props.mainBrowser) && <BrowserSettingsAction disabled={!externalUrl} icon={ExternalLink}
        onClick={() => {
        if (externalUrl) void openWebsiteInBrowser(externalUrl);
      }}>{uiText('client.workspaceActions.openInBrowser', {}, props.language)}</BrowserSettingsAction>}
      <div className="browser-settings-divider" />
      <BrowserSettingsAction icon={History} onClick={() => { dismiss(); setDataPanel('history'); }}>
        {t('market.browserHistory')}</BrowserSettingsAction>
      <BrowserSettingsAction icon={KeyRound} onClick={() => { dismiss(); setDataPanel('passwords'); }}>
        {t('market.browserPasswords')}</BrowserSettingsAction>
      <BrowserSearchSetting t={t} search={search} />
      {props.mainBrowser && <BrowserPortMappingsSetting language={props.language} compact={compact}
        close={dismiss} showDialog={() => setMappingsOpen(true)}
        visit={url => { if (tab) home.navigate(tab.id, url); }} />}
    </>,
    reload: compact ? () => home.action(activeId, 'reload') : undefined,
    navigate: url => { if (tab) home.navigate(tab.id, url); },
    newTab: url => { if (tab) props.onPopup(tab.id, url); },
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingTabs, setLoadingTabs] = useState<ReadonlySet<string>>(() => new Set());
  const loadingChanged = useCallback((id: string, loading: boolean) => {
    setLoadingTabs(current => {
      if (current.has(id) === loading) return current;
      const next = new Set(current);
      if (loading) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  useEffect(() => {
    setLoadingTabs(current => {
      const next = new Set([...current].filter(id => tabs.some(entry => entry.id === id)));
      return next.size === current.size ? current : next;
    });
  }, [tabs]);
  return <>
    {!compact && <div className="pm-browser-titlebar">{props.history}
    <BrowserTabs tabs={tabs} activeId={activeId} visible={open} t={t}
      select={props.onSelect} close={props.onCloseTab} closeTabs={props.onCloseTabs} menuChanged={setMenuOpen} />
    <button aria-label={t('market.browserNewTab')} title={t('market.browserNewTab')}
      onClick={props.onNewTab}><Plus size={17} /></button>
    {!props.embedded && <button className="pm-browser-close" aria-label={t('market.close')} title={t('market.close')}
      onClick={props.onClose}><X size={19} /></button>}</div>}
    {mobileFullscreen ? <BrowserFullscreenControl t={t} exit={props.toggleFullscreen} />
      : showManager ? <MobileTabManagerToolbar t={t} count={tabs.length} query={query} setQuery={setQuery}
      close={() => setManager(false)} add={add} closeAll={() => closeTabs(tabs.map(tab => tab.id))} /> : compact
      ? <MobileBrowserToolbar tab={displayTab} t={t} engine={search.engine} count={tabs.length}
        newTab={add} manage={() => { setQuery(''); setManager(true); }} settings={bookmarks.settings}
        navigate={url => { if (tab) home.navigate(tab.id, url); }}
        home={() => { if (tab) home.show(tab.id); }} />
      : <BrowserToolbar tab={tab} loading={Boolean(tab && loadingTabs.has(tab.id))}
      searchEngine={search.engine}
      fullscreen={props.fullscreen} toggleFullscreen={props.toggleFullscreen}
      navigate={(url) => { if (tab) props.onNavigate(tab.id, url); }}
      action={(action) => { if (tab) props.onAction(tab.id, action); }} t={t}
      actions={<><BrowserExtensions t={t} active={open} onOverlay={setExtensionsOpen} />{props.actions}</>}
      star={bookmarks.star} settings={bookmarks.settings} />}
    {!mobileFullscreen && !showManager && !(tab && home.isHome(tab.id)) && bookmarks.bar}{bookmarks.overlays}
    {mappingsOpen && <BrowserPortMappings language={props.language} close={() => setMappingsOpen(false)}
      visit={url => { if (tab) home.navigate(tab.id, url); }} />}
    {dataPanel === 'history' && <BrowserHistory language={props.language} controls={records.controls}
      close={() => setDataPanel(undefined)} visit={url => { if (tab) home.navigate(tab.id, url); }} />}
    {dataPanel === 'passwords' && <PasswordManager language={props.language} currentUrl={displayTab?.url ?? ''}
      fill={records.fill} close={() => setDataPanel(undefined)} />}
    {open && records.candidate && <PasswordCapture login={records.candidate} t={t} close={records.closeCapture} />}
    {open && records.focus && records.fill && <PasswordSuggestions language={props.language} tabId={activeId}
      focus={records.focus} fill={records.fill} close={records.closeSuggestions} />}
    <BrowserPages key="pages" browser={{ ...props, onAction: home.action, onNavigate: home.navigate,
      onCloseTab: id => closeTabs([id]) }}
      home={home.isHome} bookmarks={bookmarks.manage} t={t} manager={showManager} compact={compact} query={query}
      desktopTabs={desktopTabs}
      blocked={menuOpen || extensionsOpen || bookmarks.overlayOpen || mappingsOpen || !!dataPanel
        || !!records.candidate || !!records.focus}
      loadingChanged={loadingChanged}
      recordVisit={records.recordVisit}
      select={id => { props.onSelect(id); setManager(false); }} />
  </>;
}

export function ProviderBrowser(props: BrowserWindowProps) {
  const { open } = props;
  const [fullscreen, setFullscreen] = useState(false);
  const t = marketText(props.language);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.focus();
    return () => { previous?.focus(); };
  }, [open]);
  return createPortal(<div className="pm-browser-backdrop" hidden={!open}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-label={props.title ?? t('market.browserTitle')} tabIndex={-1}
      className={`pm-browser${fullscreen ? ' pm-browser-fullscreen' : ''}`} onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); fullscreen ? setFullscreen(false) : props.onClose(); }
        if (event.key === 'Tab') {
          const elements = [...(dialog.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input, iframe') ?? [])].filter((element) => element.getClientRects().length);
          const first = elements[0]; const last = elements.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <BrowserContents {...props} fullscreen={fullscreen} toggleFullscreen={() => setFullscreen(value => !value)} />
    </section>
  </div>, document.body);
}
