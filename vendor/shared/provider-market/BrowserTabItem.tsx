import { useRef } from 'react';
import { Dropdown } from 'antd';
import { X } from 'lucide-react';
import { useThreadLongPress } from '../chat/useThreadLongPress';
import { browserTabsToClose, type BrowserTabCloseAction } from './browserTabCommands';
import type { BrowserTab } from './browserState';
import type { MarketKey, MarketText } from './i18n';
import { BrowserTabIcon } from './BrowserTabIcon';

const CLOSE_ACTIONS: { action: BrowserTabCloseAction; label: MarketKey }[] = [
  { action: 'close', label: 'market.close' },
  { action: 'closeLeft', label: 'market.browserCloseLeftTabs' },
  { action: 'closeRight', label: 'market.browserCloseRightTabs' },
  { action: 'closeAll', label: 'market.browserCloseAllTabs' },
  { action: 'closeOthers', label: 'market.browserCloseOtherTabs' },
];

interface Props {
  tab: BrowserTab; tabs: BrowserTab[]; active: boolean; loading: boolean; menuOpen: boolean; t: MarketText;
  select: (id: string) => void; close: (id: string) => void; closeTabs: (ids: string[]) => void;
  setMenuOpen: (open: boolean) => void;
  descriptionId?: string;
}

export function BrowserTabItem({ tab, tabs, active, loading, menuOpen, t, select, close, closeTabs, setMenuOpen,
  descriptionId }: Props) {
  const button = useRef<HTMLButtonElement>(null);
  // Let Dropdown position touch and keyboard menus just like a native context-menu event.
  const gesture = useThreadLongPress(press => {
    press.target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true,
      clientX: press.x, clientY: press.y }));
  }, { nativeContextMenu: true });
  const name = tab.title || t('market.browserNewTab');
  const index = tabs.findIndex(entry => entry.id === tab.id);
  return <Dropdown trigger={['contextMenu']} open={menuOpen} autoFocus onOpenChange={value => {
    if (value) button.current?.focus({ preventScroll: true });
    setMenuOpen(value);
  }}
    overlayClassName="pm-browser-tab-menu" menu={{ 'aria-label': t('market.browserTabActions'),
      onKeyDown: event => {
        if (event.key !== 'Escape') return;
        event.preventDefault(); event.stopPropagation(); setMenuOpen(false); button.current?.focus();
      },
      items: CLOSE_ACTIONS.map(({ action, label }) => {
        const ids = browserTabsToClose(tabs, tab.id, action);
        return { key: action, label: t(label), disabled: !ids.length,
          onClick: () => { setMenuOpen(false); closeTabs(ids); } };
      }),
    }}>
    <div {...gesture} className={`pm-browser-tab${active ? ' active' : ''}`}
      data-overflow-tab data-path={tab.id} data-active={active}>
      <button ref={button} type="button" role="tab" aria-selected={active} tabIndex={active ? 0 : -1}
        aria-controls={`page-${tab.id}`} aria-busy={loading} aria-haspopup="menu" aria-expanded={menuOpen}
        onClick={() => select(tab.id)} aria-describedby={descriptionId} onKeyDown={event => {
          const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1,
            Home: -index, End: tabs.length - index - 1 };
          if (!(event.key in offsets)) return;
          event.preventDefault(); select(tabs[(index + offsets[event.key] + tabs.length) % tabs.length].id);
        }}><BrowserTabIcon tab={tab} loading={loading} /><span>{name}</span></button>
      <button type="button" aria-label={t('market.browserCloseTab', { name })}
        onClick={() => close(tab.id)}><X size={14} /></button>
    </div>
  </Dropdown>;
}
