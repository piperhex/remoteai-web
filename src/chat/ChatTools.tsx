import { displayText, t } from '../../../../shared/localization/browserClient';
import { useContext, useEffect, useState, type ReactNode } from 'react';
import { WorkspaceDrawerContext, workspaceTabId } from '../../../../shared/chat/workspaceDrawer';
import { useWorkspaceLauncher } from '../../../../shared/chat/workspaceLaunchers';
import { Popover } from 'antd';
import { FolderSearch, GitBranch, Monitor, SquareTerminal, Wrench } from 'lucide-react';
import type { GuiToolsClient } from '../../../../shared/remote-chat/guiTools';
import { useDesktopLauncher } from '../../../../shared/remote-desktop/useDesktopLauncher';
import { useRetainedProjects } from '../../../../shared/remote-chat/useRetainedProjects';
import { useRemoteTerminalLauncher } from '../../../../shared/remote-chat/useRemoteTerminalLauncher';
import { ChatTerminal } from './ChatTerminal';
import { ChatGit } from '../../../../shared/git/views/ChatGit';
import { GuiRemoteDesktop } from '../../../../shared/conversation/GuiRemoteDesktop';
import '../../../../shared/git/views/git.css';
import { ProjectBrowserDrawer } from '../../../../shared/project-browser/views/ProjectBrowserDrawer';
import { useDesktopLayout } from '../../../../shared/layout/useDesktopLayout';
import { useProjectBrowsers } from '../../../../shared/project-browser/useProjectBrowsers';
import './desktopTools.css';

interface Props {
  client: GuiToolsClient; cwd: string; active: boolean; connected: boolean; deviceName?: string;
  desktopActions?: ReactNode;
  closeDeviceDesktop?: () => void;
  terminal?: ReturnType<typeof useRemoteTerminalLauncher>;
}
export function ChatTools(props: Props) {
  const fallbackTerminal = useRemoteTerminalLauncher({ client: props.client.terminal,
    cwd: props.cwd, connected: !props.terminal && props.connected });
  const terminal = props.terminal ?? fallbackTerminal;
  const browsers = useProjectBrowsers();
  const git = useRetainedProjects();
  const desktop = useDesktopLauncher();
  const closeDeviceDesktop = props.closeDeviceDesktop;
  const launcher: typeof desktop = closeDeviceDesktop ? { ...desktop, opened: true, minimized: false,
    close: () => { desktop.close(); closeDeviceDesktop(); },
    setMinimized: update => {
      const minimized = typeof update === 'function' ? update(false) : update;
      if (!minimized) return;
      desktop.open();
      desktop.hide();
      closeDeviceDesktop();
    },
  } : desktop;
  const desktopLayout = useDesktopLayout();
  const wide = desktopLayout && Boolean(props.desktopActions);
  const workspace = useContext(WorkspaceDrawerContext);
  const [menu, setMenu] = useState(false);
  useEffect(() => { if (!props.active) setMenu(false); }, [props.active]);
  const hideTools = () => { browsers.close(); git.hide(); desktop.hide(); terminal.hide(); workspace?.tabs.hide(); };
  const openFiles = () => {
    hideTools();
    const id = workspaceTabId.files(props.cwd);
    if (!workspace?.tabs.entries.some(tab => tab.id === id)) browsers.open(props.cwd);
    workspace?.tabs.open(id);
  };
  const openGit = () => { hideTools(); git.open(props.cwd); workspace?.tabs.open(workspaceTabId.git(props.cwd)); };
  useWorkspaceLauncher({ id: 'files', tabId: workspaceTabId.files(props.cwd),
    enabled: props.active && props.connected && Boolean(props.cwd), open: openFiles });
  useWorkspaceLauncher({ id: 'git', tabId: workspaceTabId.git(props.cwd),
    enabled: props.active && props.connected && Boolean(props.cwd), open: openGit });
  const isOpen = (id: string) => !workspace?.tabs.closed.has(id);
  const opened = { desktop: desktop.opened, terminal: terminal.anyOpened,
    git: git.projects.some(cwd => isOpen(workspaceTabId.git(cwd))),
    files: browsers.projects.some(cwd => isOpen(workspaceTabId.files(cwd))) };
  const items = [
    { id: 'desktop' as const, icon: Monitor, label: t('client.remoteDesktop.remoteDesktop'),
      disabled: !props.connected && !opened.desktop, open: () => { hideTools(); desktop.open(); } },
    { id: 'terminal' as const, icon: SquareTerminal, label: t('client.projectBrowser.terminal'),
      disabled: !props.connected && !opened.terminal, open: () => { hideTools(); terminal.show(); } },
    { id: 'git' as const, icon: GitBranch, label: displayText('Git'), open: openGit },
    { id: 'files' as const, icon: FolderSearch, label: t('client.projectBrowser.browseFiles'),
      disabled: (!props.connected || !props.cwd) && !opened.files, open: openFiles },
  ];
  return <>
    <GuiRemoteDesktop client={props.client.desktop} active={props.active || !!closeDeviceDesktop}
      connected={props.connected} launcher={launcher} hideTrigger={!wide} keepAlive />
    {wide && props.desktopActions}
    {!wide && <Popover trigger="click" placement="bottomRight" arrow={false}
      open={menu && props.active} onOpenChange={setMenu} styles={{ root: { maxWidth: 400 } }}
      content={<div className="chat-tools-menu">
        {items.map(item => <button key={item.id} type="button" disabled={item.disabled}
          aria-pressed={opened[item.id]} data-opened={opened[item.id]}
          onClick={() => { setMenu(false); item.open(); }}>
          <item.icon size={20} />{item.label}</button>)}
      </div>}>
      <button type="button" className="chat-terminal-toggle" aria-label={t('client.git.openTools')}
        aria-expanded={menu && props.active}><Wrench size={22} /></button>
    </Popover>}
    <ChatTerminal {...props} client={props.client.terminal} panel={terminal} hideTrigger={!wide} />
    {git.projects.map(cwd => <ChatGit key={cwd} {...props} cwd={cwd} client={props.client.git}
      active={props.active && (wide || git.visible === cwd)} onHide={git.hide} onClose={() => git.close(cwd)} />)}
    {browsers.projects.map(project => <ProjectBrowserDrawer key={project} client={props.client.projectBrowser}
      cwd={project} active={props.active && browsers.visible === project} closeOnDismiss
      connected={props.connected} onClose={browsers.close} />)}
  </>;
}
