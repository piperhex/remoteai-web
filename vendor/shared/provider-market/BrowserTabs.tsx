import { useEffect, useState } from 'react';
import { Dropdown } from 'antd';
import { isTauri } from '@tauri-apps/api/core';
import type { Language } from '@remoteai/i18n';
import { Ellipsis, X } from 'lucide-react';
import { useTabOverflow } from '../project-browser/useTabOverflow';
import type { BrowserTab } from './browserState';
import type { MarketText } from './i18n';
import { BrowserTabItem } from './BrowserTabItem';
import { BrowserTabIcon } from './BrowserTabIcon';
import { BrowserTabHoverCard, type BrowserTabVisit } from './BrowserTabHoverCard';
import { useBrowserTabHover } from './useBrowserTabHover';
import { useBrowserOverlay } from '../browser/overlays/BrowserOverlayProvider';

interface Props {
  tabs: BrowserTab[]; activeId: string; visible: boolean; t: MarketText;
  language: Language; visits: ReadonlyMap<string, BrowserTabVisit>;
  select: (id: string) => void; close: (id: string) => void; menuChanged: (open: boolean) => void;
  closeTabs: (ids: string[]) => void;
  windowDragRegion?: boolean;
}

/** Match project and workspace tabs: reveal the selection, fade the clipped left edge and list hidden tabs. */
export function BrowserTabs({ tabs, activeId, visible, t, language, visits, select, close, closeTabs,
  menuChanged, windowDragRegion }: Props) {
  const overflow = useTabOverflow(tabs.map(tab => ({ path: tab.id })), activeId);
  const hidden = tabs.filter(tab => overflow.hiddenPaths.includes(tab.id));
  const [open, setOpen] = useState(false);
  const [contextId, setContextId] = useState<string | null>(null);
  const name = (tab: BrowserTab) => tab.title || t('market.browserNewTab');
  const focusSelected = () => overflow.viewport.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
    ?.focus({ preventScroll: true });
  const choose = (id: string) => {
    overflow.reveal(id); select(id); setOpen(false); setContextId(null); requestAnimationFrame(focusSelected);
  };
  const closeTab = (id: string) => { close(id); setOpen(false); requestAnimationFrame(focusSelected); };
  const closeMany = (ids: string[]) => { closeTabs(ids); setContextId(null); requestAnimationFrame(focusSelected); };
  const contextOpen = visible && tabs.some(tab => tab.id === contextId);
  const hover = useBrowserTabHover(visible && !open && !contextOpen);
  const hovered = hover.anchor && tabs.find(tab => tab.id === hover.anchor?.dataset.path);
  const overlay = useBrowserOverlay();
  const coversNativePage = Boolean(hovered && !overlay && isTauri());
  useEffect(() => { if (!visible) setContextId(null); }, [visible]);
  useEffect(() => { if (!visible || !hidden.length) setOpen(false); }, [visible, hidden.length]);
  useEffect(() => { menuChanged(open || contextOpen || coversNativePage); },
    [open, contextOpen, coversNativePage, menuChanged]);
  return <div ref={overflow.bar} className="pm-browser-tabs-bar" data-clipped-left={overflow.clippedLeft}
    data-tauri-drag-region={windowDragRegion || undefined}
    onKeyDown={event => {
      if (event.key !== 'Escape') return;
      if (contextOpen) {
        event.preventDefault(); event.stopPropagation(); setContextId(null); focusSelected(); return;
      }
      if (!open) return;
      event.preventDefault(); event.stopPropagation(); setOpen(false);
      event.currentTarget.querySelector<HTMLButtonElement>('.pm-browser-tabs-more')?.focus();
    }}>
    <div ref={overflow.viewport} className="pm-browser-tabs" role="tablist" aria-label={t('market.browserTabs')}
      data-tauri-drag-region={windowDragRegion || undefined} {...hover.events}>
      {tabs.map(tab => <BrowserTabItem key={tab.id} tab={tab} tabs={tabs} active={tab.id === activeId}
        t={t} select={choose} close={closeTab} closeTabs={closeMany} menuOpen={contextOpen && contextId === tab.id}
        descriptionId={hovered?.id === tab.id && !overlay ? `tab-hover-${tab.id}` : undefined}
        setMenuOpen={value => { setContextId(value ? tab.id : null); if (value) setOpen(false); }} />)}
    </div>
    {overflow.overflowing && <Dropdown trigger={['click']} open={open}
      onOpenChange={value => { setOpen(value); if (value) setContextId(null); }} autoFocus
      placement="bottomRight" getPopupContainer={trigger => trigger.parentElement ?? trigger}
      overlayClassName="pm-browser-tabs-menu" menu={{ 'aria-label': t('market.browserHiddenTabs'),
        items: hidden.map(tab => ({ key: tab.id, label: <div className="pm-browser-tabs-menu-item">
          <BrowserTabIcon tab={tab} /><span>{name(tab)}</span>
          <button type="button" aria-label={t('market.browserCloseTab', { name: name(tab) })}
            onClick={event => { event.stopPropagation(); closeTab(tab.id); }}><X size={14} /></button>
        </div> })), onClick: ({ key }) => choose(key),
      }}>
      <button type="button" className="pm-browser-tabs-more" aria-label={t('market.browserMoreTabs')}
        aria-haspopup="menu" aria-expanded={open}><Ellipsis size={18} /></button>
    </Dropdown>}
    {hovered && hover.anchor && <BrowserTabHoverCard key={`${hovered.id}:${hovered.url}`} anchor={hover.anchor}
      tab={hovered} visit={visits.get(hovered.id)} language={language} t={t} stay={hover.cancel} leave={hover.leave} />}
  </div>;
}
