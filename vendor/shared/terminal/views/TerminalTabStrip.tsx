import { useEffect, useState } from 'react';
import { Dropdown } from 'antd';
import { Ellipsis, X } from 'lucide-react';
import type { TerminalTab } from './useTerminalPanel';
import { useTabOverflow } from '../../project-browser/useTabOverflow';
import { sshLabel } from '../sshProfiles';
import styles from './terminal.module.less';
import { TerminalTabItem } from './TerminalTabItem';

export function TerminalTabStrip({ tabs, selected, select, remove, removeTabs, visible, translate }: {
  tabs: TerminalTab[]; selected: string | null; select: (id: string) => void; remove: (id: string) => void;
  removeTabs: (ids: string[]) => void; visible: boolean;
  translate: (key: string, values?: { number: number }) => string;
}) {
  const overflow = useTabOverflow(tabs.map(tab => ({ path: tab.id })), selected ?? undefined);
  const hidden = tabs.filter(tab => overflow.hiddenPaths.includes(tab.id));
  const [open, setOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  useEffect(() => { if (!visible || !hidden.length) setOpen(false); }, [visible, hidden.length]);
  useEffect(() => {
    if (!visible || !tabs.some(tab => tab.id === menuId)) setMenuId(null);
  }, [visible, tabs, menuId]);
  const label = (tab: TerminalTab) => tab.session?.ssh ? sshLabel(tab.session.ssh)
    : (tab.npmScript ?? tab.session?.npmScript) ? `npm run ${tab.npmScript ?? tab.session?.npmScript}`
      : tab.cwd || `${translate('client.projectBrowser.terminal')} ${tabs.indexOf(tab) + 1}`;
  const closeLabel = (tab: TerminalTab) => translate('client.terminal.closeTab', { number: tabs.indexOf(tab) + 1 });
  const choose = (id: string) => { overflow.reveal(id); select(id); setOpen(false); setMenuId(null); };
  const closeGroup = (ids: string[]) => { removeTabs(ids); setOpen(false); setMenuId(null); };
  const closeTab = (id: string) => { remove(id); setOpen(false); setMenuId(null); };
  return <div ref={overflow.bar} className={styles.tabsBar} onKeyDown={event => {
    if (event.key !== 'Escape' || (!menuId && !open)) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"][aria-expanded="true"]')
      ?.focus({ preventScroll: true });
    setMenuId(null); setOpen(false);
  }}>
    <div ref={overflow.viewport} className={styles.tabs} role="tablist"
      aria-label={translate('client.chat.terminalTabs')}>
      {tabs.map(tab => <TerminalTabItem key={tab.id} tab={tab} tabs={tabs} selected={selected === tab.id}
        label={label(tab)} closeLabel={closeLabel(tab)} menuOpen={menuId === tab.id} visible={visible}
        choose={choose} remove={closeTab} removeTabs={closeGroup}
        setMenuOpen={value => { setMenuId(value ? tab.id : null); if (value) setOpen(false); }} />)}
    </div>
    {overflow.overflowing && <Dropdown trigger={['click']} open={open}
      onOpenChange={value => { setOpen(value); if (value) setMenuId(null); }}
      overlayStyle={{ maxWidth: 'min(400px, calc(100vw - 16px))' }} menu={{
        items: hidden.map(tab => ({ key: tab.id, label: <div className={styles.overflowItem}>
          <span>{label(tab)}{tab.subtitle && <small className={styles.tabSubtitle}>{tab.subtitle}</small>}</span>
          <button type="button" aria-label={closeLabel(tab)}
            onClick={event => { event.stopPropagation(); remove(tab.id); }}><X size={16} /></button>
        </div> })), onClick: ({ key }) => choose(key),
      }}>
      <button type="button" className={styles.iconButton} aria-label={translate('client.terminal.moreTabs')}
        aria-haspopup="menu" aria-expanded={open}><Ellipsis size={18} /></button>
    </Dropdown>}
  </div>;
}
