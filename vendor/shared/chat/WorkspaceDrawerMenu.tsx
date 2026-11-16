import { useEffect, useRef, useState } from 'react';
import { Dropdown, type MenuProps } from 'antd';
import { Ellipsis, Plus, X } from 'lucide-react';
import { useDiffText } from './diffText';
import type { WorkspaceTab } from './workspaceDrawer';
import type { WorkspaceTabAction } from '../conversation/useWorkspaceTabActions';

const ADD_MENU = 'add-workspace-tab';

export function WorkspaceDrawerMenu({ actions, hidden, overflowing, open, setOpen, choose, close }: {
  actions: WorkspaceTabAction[]; hidden: WorkspaceTab[]; overflowing: boolean; open: boolean;
  setOpen: (open: boolean) => void; choose: (id: string) => void; close: (id: string) => void;
}) {
  const t = useDiffText();
  const button = useRef<HTMLButtonElement>(null);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const addLabel = t('client.mobile.add.07a04d');
  useEffect(() => { if (!open) setOpenKeys([]); }, [open]);
  const additions = actions.map(action => ({ key: `add:${action.id}`, label: action.title,
    icon: action.icon, disabled: action.disabled,
    onClick: () => { setOpen(false); action.open(); },
  }));
  if (!overflowing && !additions.length) return null;
  const items: MenuProps['items'] = overflowing ? [
    ...(additions.length ? [
      { key: ADD_MENU, label: addLabel, children: additions, popupClassName: 'workspace-drawer-add-submenu' },
      { type: 'divider' as const },
    ] : []),
    ...hidden.map(tab => ({ key: tab.id, onClick: () => choose(tab.id),
      label: <div className="workspace-drawer-tabs-menu-item">
        {tab.icon}<span>{tab.title}</span>
        <button type="button" className="workspace-drawer-tab-close"
          aria-label={t('client.mobile.close', { value1: tab.title })}
          onClick={event => { event.stopPropagation(); close(tab.id); }}><X size={14} /></button>
      </div>,
    })),
  ] : additions;
  return <Dropdown trigger={['click']} open={open} onOpenChange={setOpen} autoFocus
    placement={overflowing ? 'bottomRight' : 'bottomLeft'}
    align={{ overflow: { adjustX: true, adjustY: true, shiftX: true } }}
    getPopupContainer={trigger => trigger.parentElement ?? trigger}
    overlayClassName={`workspace-drawer-tabs-menu${overflowing ? '' : ' workspace-drawer-add-menu'}`}
    menu={{ items, openKeys, onOpenChange: setOpenKeys,
      'aria-label': overflowing ? t('client.projectBrowser.hiddenTabs') : addLabel,
      onKeyDown: event => {
        if (event.key !== 'Escape') return;
        event.preventDefault(); event.stopPropagation();
        if (openKeys.length) {
          setOpenKeys([]);
          button.current?.parentElement?.querySelector<HTMLElement>('.ant-dropdown-menu-submenu-title')?.focus();
        } else { setOpen(false); button.current?.focus(); }
      },
    }}>
    <button ref={button} type="button"
      className={overflowing ? 'workspace-drawer-tabs-more' : 'workspace-drawer-tabs-add'}
      aria-label={overflowing ? t('client.projectBrowser.moreTabs') : addLabel}
      aria-haspopup="menu" aria-expanded={open}>{overflowing ? <Ellipsis size={18} /> : <Plus size={18} />}</button>
  </Dropdown>;
}
