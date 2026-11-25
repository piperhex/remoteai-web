import { useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { BrowserNavigationContext } from '../../browser/BrowserNavigationProvider';
import { useDesktopLayout } from '../../layout/useDesktopLayout';
import { DetailsContext, type DiffPanelEntry } from '../../conversation/detailsContext';
import { FileEnvironmentContext } from '../../conversation/fileEnvironment';
import { ChatFileContext } from './ChatFileLink';
import { chatBrowserResource } from './chatBrowserResource';
import { MobileChatDiff } from './MobileChatDiff';
import type { ReadSavedReview } from '../../conversation/savedReview';
import type { BrowserResource } from '../../file-preview/workspace/browserResources';
import type { FilePreviewTarget } from '../../file-preview/workspace/usePreviewHistory';

// The phone has no workspace-wide changes tab.
const ignoreWorkspaceChanges = () => {};

interface Props { children: ReactNode; active: boolean; readSavedReview?: ReadSavedReview }

/** Keep desktop's details panel while phone previews join the application's main browser. */
export function MobileChatBrowser(props: Props) {
  const navigation = useContext(BrowserNavigationContext);
  return navigation ? <MobileChatBrowserRoutes {...props} /> : props.children;
}

function MobileChatBrowserRoutes({ children, active, readSavedReview }: Props) {
  const navigation = useContext(BrowserNavigationContext);
  const panel = useContext(DetailsContext);
  const environment = useContext(FileEnvironmentContext);
  const files = useContext(ChatFileContext);
  const desktop = useDesktopLayout();
  const [review, setReview] = useState<DiffPanelEntry | null>(null);
  const updateReview = useCallback((entry: DiffPanelEntry) => {
    setReview(current => current?.id === entry.id ? { ...entry,
      filePath: entry.files.some(file => file.path === current.filePath) ? current.filePath : undefined } : current);
  }, []);
  useEffect(() => { setReview(null); }, [files?.threadId, active, desktop]);
  if (desktop || !navigation || !files) return children;
  const openResource = (resource: BrowserResource) => navigation.openResource({ ...resource,
    render: props => <FileEnvironmentContext.Provider value={environment}>
      <DetailsContext.Provider value={context}>{resource.render(props)}</DetailsContext.Provider>
    </FileEnvironmentContext.Provider>,
  });
  const openFile = async (target: FilePreviewTarget) => {
    openResource(chatBrowserResource(target.path, { ...files, threadId: target.threadId }, target.line));
    return true;
  };
  const close = () => setReview(null);
  const context = { ...(panel ?? { open: setReview, update: updateReview, setConversationChanges: ignoreWorkspaceChanges,
    showingChanges: !!review, visible: !!review, close }), readSavedReview, openFile, openRemoteFile: openFile, openResource,
    openWebsite: (url: string, options?: { resolved?: boolean }) => navigation.openWebsite(url,
      { ...options, resolve: environment?.resolveWebsite }),
  };
  return <DetailsContext.Provider value={context}>{children}
    {active && review && <MobileChatDiff entry={review} readSavedReview={readSavedReview} onClose={close} />}
  </DetailsContext.Provider>;
}
