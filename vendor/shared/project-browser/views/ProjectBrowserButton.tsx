import { useProjectBrowsers } from '../useProjectBrowsers';
import { useContext } from 'react';
import { WorkspaceDrawerContext, workspaceTabId } from '../../chat/workspaceDrawer';
import { useWorkspaceLauncher } from '../../chat/workspaceLaunchers';
import { FolderSearch } from 'lucide-react';
import type { ProjectBrowserClient } from '../protocol';
import { ProjectBrowserDrawer } from './ProjectBrowserDrawer';
import { t, useLanguage } from '../../localization/browserClient';
import type { BrowserHost } from '../entryActions';

export function ProjectBrowserButton({ client, cwd, connected, active, className, desktopStyle, host }: {
  client: ProjectBrowserClient; cwd: string; connected: boolean; active: boolean;
  className?: string; desktopStyle?: boolean; host?: BrowserHost;
}) {
  useLanguage();
  const browsers = useProjectBrowsers();
  const workspace = useContext(WorkspaceDrawerContext);
  const id = workspaceTabId.files(cwd);
  const visible = workspace?.tabs.visible && workspace.tabs.selected === id;
  const openFiles = () => {
    if (!workspace?.tabs.entries.some(tab => tab.id === id)) browsers.open(cwd);
    workspace?.tabs.open(id);
  };
  useWorkspaceLauncher({ id: 'files', tabId: id, enabled: active && connected && Boolean(cwd), open: openFiles });
  return <>
    <button type="button" className={className} disabled={!active || !connected || !cwd}
      aria-label={t("client.projectBrowser.browseFiles")} aria-haspopup="dialog" aria-expanded={Boolean(visible)}
      onClick={openFiles}>
      <FolderSearch size={16} /><span>{t("client.projectBrowser.browseFiles")}</span></button>
    {browsers.projects.map(project => <ProjectBrowserDrawer key={project} client={client} cwd={project}
      connected={connected} active={active && browsers.visible === project}
      desktopStyle={desktopStyle} host={host} onClose={browsers.close} />)}
  </>;
}
