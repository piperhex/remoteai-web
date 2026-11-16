import { useEffect, useState } from 'react';
import { useDiffText } from './diffText';
import { useTabOverflow } from '../project-browser/useTabOverflow';
import type { WorkspaceTab } from './workspaceDrawer';
import { WorkspaceDrawerTabItem } from './WorkspaceDrawerTabItem';
import { WorkspaceDrawerMenu } from './WorkspaceDrawerMenu';
import type { WorkspaceTabAction } from '../conversation/useWorkspaceTabActions';
import './workspaceDrawer.css';

export function WorkspaceDrawerTabs({ tabs, actions, selected, visible, choose, close, closeTabs }: {
  tabs: WorkspaceTab[]; selected: string | null; visible: boolean;
  actions: WorkspaceTabAction[];
  choose: (id: string) => void; close: (id: string) => void;
  closeTabs: (ids: string[]) => void;
}) {
  const t = useDiffText();
  const overflow = useTabOverflow(tabs.map(tab => ({ path: tab.id })), selected ?? undefined, actions.length > 0);
  const hidden = tabs.filter(tab => overflow.hiddenPaths.includes(tab.id));
  const [open, setOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const focusSelected = () => overflow.viewport.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
    ?.focus({ preventScroll: true });
  const select = (id: string) => {
    overflow.reveal(id); choose(id); setOpen(false); setMenuId(null); requestAnimationFrame(focusSelected);
  };
  const closeGroup = (ids: string[]) => {
    closeTabs(ids); setOpen(false); setMenuId(null); requestAnimationFrame(focusSelected);
  };
  const closeTab = (id: string) => {
    close(id); setOpen(false); setMenuId(null); requestAnimationFrame(focusSelected);
  };
  useEffect(() => { setOpen(false); }, [visible, overflow.overflowing]);
  useEffect(() => {
    if (!visible || !tabs.some(tab => tab.id === menuId)) setMenuId(null);
  }, [visible, tabs, menuId]);
  useEffect(() => {
    if (visible) overflow.viewport.current?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [visible, selected]);
  return <div ref={overflow.bar} className="workspace-drawer-tabs-bar" data-clipped-left={overflow.clippedLeft}
    onKeyDown={event => {
      if ((!open && !menuId) || event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      if (menuId) {
        event.currentTarget.querySelector<HTMLButtonElement>('.workspace-drawer-tab-select[aria-expanded="true"]')
          ?.focus();
        setMenuId(null); return;
      }
      setOpen(false);
      event.currentTarget.querySelector<HTMLButtonElement>('.workspace-drawer-tabs-more, .workspace-drawer-tabs-add')
        ?.focus();
    }}>
    <div ref={overflow.viewport} className="workspace-drawer-tabs" role="tablist"
    aria-label={t('client.desktopGuiExtras.sidebarContent')}>
    {tabs.map(tab => <WorkspaceDrawerTabItem key={tab.id} tab={tab} tabs={tabs} selected={selected}
      menuOpen={menuId === tab.id} choose={select} close={closeTab} closeTabs={closeGroup}
      setMenuOpen={value => { setMenuId(value ? tab.id : null); if (value) setOpen(false); }} />)}
    </div>
    <WorkspaceDrawerMenu actions={actions} hidden={hidden} overflowing={overflow.overflowing} open={open}
      setOpen={value => { setOpen(value); if (value) setMenuId(null); }} choose={select} close={closeTab} />
  </div>;
}
