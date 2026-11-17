import { cloneElement, useState, type HTMLAttributes, type KeyboardEvent, type ReactElement } from 'react';
import { Dropdown, message } from 'antd';
import { AppWindow, Copy, ExternalLink, PanelRight } from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { uiText } from "../localization/uiText";
import { useThreadLongPress } from '../chat/useThreadLongPress';
import { useWebsiteLinkActions } from './useWebsiteLinkActions';
import styles from './FileMenu.module.less';

function reportLinkError() {
  void message.error({ content: uiText("client.conversation.couldNotOpenTheLinkPleaseTryAgainShortly"),
    style: { maxWidth: 400, marginInline: 'auto' } });
}

export async function openWebsiteInBrowser(url: string, resolve?: (url: string) => Promise<string>) {
  try {
    if (resolve) url = await resolve(url);
    if (isTauri()) await openUrl(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  } catch { reportLinkError(); }
}

export function WebsiteLinkMenu({ href, children }: { href: string; children: ReactElement }) {
  const [open, setOpen] = useState(false);
  const actions = useWebsiteLinkActions(href);
  const gesture = useThreadLongPress(() => setOpen(true), { enabled: !actions.busy });
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); }
    else gesture.onKeyDown(event);
  };
  return <Dropdown trigger={['contextMenu']} open={open} onOpenChange={setOpen} autoFocus
    disabled={actions.busy} overlayClassName={styles.popup} overlayStyle={{ maxWidth: 400 }}
    menu={{ onClick: () => setOpen(false), onKeyDown, items: [
      { key: 'sidebar', label: uiText('client.terminal.openInSidebarBrowser'), icon: <PanelRight size="1.2em" />,
        disabled: actions.busy || !actions.sidebar, onClick: () => { void actions.open('sidebar'); } },
      { key: 'standalone', label: uiText('client.terminal.openInStandaloneBrowser'), icon: <AppWindow size="1.2em" />,
        disabled: actions.busy || !actions.standalone, onClick: () => { void actions.open('standalone'); } },
      { key: 'external', label: uiText('client.terminal.openInExternalBrowser'), icon: <ExternalLink size="1.2em" />,
        disabled: actions.busy, onClick: () => { void actions.open('external'); } },
      { type: 'divider' },
      { key: 'copy', label: uiText('client.mobile.copyLink'), icon: <Copy size="1.2em" />,
        onClick: () => { void actions.copy(); } },
    ] }}>
    {cloneElement(children as ReactElement<HTMLAttributes<HTMLElement>>, {
      ...gesture, onKeyDown, 'aria-haspopup': 'menu', 'aria-expanded': open,
    })}
  </Dropdown>;
}
