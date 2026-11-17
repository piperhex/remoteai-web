import { displayText } from '../../localization/browserClient';
import { lazy, Suspense, useCallback, useContext, useMemo, useRef } from 'react';
import { FolderSearch } from 'lucide-react';
import { WorkspaceDrawerTab } from '../../chat/WorkspaceDrawerTab';
import { WorkspaceDrawerContext, workspaceTabId } from '../../chat/workspaceDrawer';
import { useChatFileReference, useChatFileSelection } from '../../chat/ChatFileReferences';
import type { ProjectBrowserClient } from '../protocol';
import type { ProjectBrowserHandle } from '../ProjectBrowser';
import { useGitTheme } from '../../git/views/gitTheme';
import { browserHost } from './browserHost';
import type { BrowserHost } from '../entryActions';
import { TerminalLaunchContext } from '../../terminal/TerminalLaunchContext';
import { terminalDirectory } from '../terminalDirectory';
import { t, useLanguage } from '../../localization/browserClient';
import './projectBrowserDrawer.css';
import { browserFileRenderer } from '../../file-preview/BrowserFilePreview';
import { projectPreviewLoader } from '../../file-preview/projectLoader';

const Browser = lazy(() => import('../ProjectBrowser')
  .then(module => ({ default: module.ProjectBrowser })));
const FILES_ICON = <FolderSearch size={16} />;

export function ProjectBrowserDrawer({ client, cwd, connected, active, onClose,
  desktopStyle = false, host: suppliedHost, closeOnDismiss = false }: {
  client: ProjectBrowserClient; cwd: string; connected: boolean; active: boolean;
  onClose: () => void; desktopStyle?: boolean; host?: BrowserHost;
  closeOnDismiss?: boolean;
}) {
  useLanguage();
  const theme = useGitTheme(desktopStyle);
  const browser = useRef<ProjectBrowserHandle>(null);
  const reference = useChatFileReference();
  const quoteSelection = useChatFileSelection();
  const workspace = useContext(WorkspaceDrawerContext);
  const launchTerminal = useContext(TerminalLaunchContext);
  const save = useCallback(() => browser.current?.saveActive(), []);
  const renderPreview = useMemo(() => browserFileRenderer(projectPreviewLoader(client, cwd)), [client, cwd]);
  const hide = workspace?.tabs.hide;
  const actionsHost = useMemo<BrowserHost>(() => ({
    ...(suppliedHost ?? browserHost(client)),
    openTerminal: launchTerminal ? entry => launchTerminal(terminalDirectory(entry)) : suppliedHost?.openTerminal,
    reference: async entry => {
      const focus = reference(entry);
      hide?.();
      requestAnimationFrame(focus);
    },
    quoteSelection: async selection => {
      const focus = quoteSelection(selection);
      hide?.();
      requestAnimationFrame(focus);
    },
  }), [suppliedHost, client, reference, quoteSelection, hide, launchTerminal]);
  return <WorkspaceDrawerTab active={active}
    tab={{ id: workspaceTabId.files(cwd), title: t("client.projectBrowser.browseFiles"),
      icon: FILES_ICON, save, closeOnDismiss }}
    className="project-browser-drawer" style={theme}>
    {visible => <Suspense fallback={<p className="project-browser-loading" role="status">{t("client.projectBrowser.loading")}</p>}>
      <Browser ref={browser} client={client} cwd={cwd} connected={connected} t={displayText} active={visible}
        onClose={onClose} host={actionsHost} renderPreview={renderPreview} />
    </Suspense>}
  </WorkspaceDrawerTab>;
}
