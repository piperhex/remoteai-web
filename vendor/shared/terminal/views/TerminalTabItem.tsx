import { useRef } from 'react';
import { Dropdown, Tooltip } from 'antd';
import { SquareTerminal, X } from 'lucide-react';
import { useThreadLongPress } from '../../chat/useThreadLongPress';
import { guiLanguage } from '../../localization/uiText';
import { marketText } from '../../provider-market/i18n';
import type { TerminalTab } from './useTerminalPanel';
import styles from './terminal.module.less';

export function TerminalTabItem({ tab, tabs, selected, label, closeLabel, menuOpen, visible,
  choose, remove, removeTabs, setMenuOpen }: {
  tab: TerminalTab; tabs: TerminalTab[]; selected: boolean; label: string; closeLabel: string;
  menuOpen: boolean; visible: boolean; choose: (id: string) => void; remove: (id: string) => void;
  removeTabs: (ids: string[]) => void; setMenuOpen: (open: boolean) => void;
}) {
  const { subtitle } = tab;
  const text = marketText(guiLanguage());
  const button = useRef<HTMLButtonElement>(null);
  const gesture = useThreadLongPress(press => {
    press.target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true,
      clientX: press.x, clientY: press.y }));
  }, { enabled: visible, nativeContextMenu: true });
  const others = tabs.filter(entry => entry.id !== tab.id).map(entry => entry.id);
  const right = tabs.slice(tabs.findIndex(entry => entry.id === tab.id) + 1).map(entry => entry.id);
  const closeGroup = (ids: string[]) => { setMenuOpen(false); removeTabs(ids); };
  return <Dropdown trigger={['contextMenu']} open={menuOpen} autoFocus onOpenChange={open => {
    if (open) button.current?.focus({ preventScroll: true });
    setMenuOpen(open);
  }} overlayStyle={{ maxWidth: 'min(400px, calc(100vw - 16px))' }} menu={{
    'aria-label': text('market.browserTabActions'),
    onKeyDown: event => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); setMenuOpen(false); button.current?.focus();
    },
    items: [
      { key: 'others', label: text('market.browserCloseOtherTabs'), disabled: !others.length,
        onClick: () => closeGroup(others) },
      { key: 'right', label: text('market.browserCloseRightTabs'), disabled: !right.length,
        onClick: () => closeGroup(right) },
    ],
  }}>
    <div {...gesture} className={styles.tab} data-overflow-tab data-path={tab.id}
      data-active={selected} data-selected={selected} onMouseDown={event => {
        // Native right-click focus can scroll a clipped tab and immediately dismiss its menu.
        if (event.button === 2) event.preventDefault();
      }}>
      <Tooltip title={menuOpen ? null : <>{label}{subtitle && <div>{subtitle}</div>}</>} styles={{ root: { maxWidth: 400 } }}>
        <button ref={button} type="button" role="tab" id={`terminal-tab-${tab.id}`} aria-selected={selected}
          aria-controls={`terminal-pane-${tab.id}`} aria-haspopup="menu" aria-expanded={menuOpen}
          onClick={() => choose(tab.id)}>
          <SquareTerminal size={15} />{subtitle
            ? <span className={styles.tabLines}><span>{label}</span>
              <small className={styles.tabSubtitle}>{subtitle}</small></span>
            : <span>{label}</span>}
        </button>
      </Tooltip>
      <button type="button" aria-label={closeLabel} onClick={() => remove(tab.id)}><X size={14} /></button>
    </div>
  </Dropdown>;
}
