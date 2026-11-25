import { displayText } from '../../localization/browserClient';
import { useContext, useMemo, type ReactNode } from 'react';
import { DetailsWorkspace } from '../../conversation/DetailsWorkspace';
import { DiffTextContext, type DiffTranslate } from '../../chat/diffText';
import { useLanguage } from '../../localization/browserClient';
import { ChatFileContext } from './ChatFileLink';
import { ChatRemoteFilePreview } from './ChatRemoteFilePreview';
import './detailsWorkspace.css';
import { RemoteBrowserResourceContext } from '../../file-preview/workspace/browserResources';
import { chatBrowserResource } from './chatBrowserResource';
import type { FilePreviewTarget } from '../../file-preview/workspace/usePreviewHistory';
import type { ReadSavedReview } from '../../conversation/savedReview';
import { MobileChatBrowser } from './MobileChatBrowser';

/** Keep one layout tree across viewport changes so composer drafts and terminal sessions survive. */
export function ChatDetailsWorkspace({ selected, active, enabled, readSavedReview, children }: {
  selected: string | null; active: boolean; enabled: boolean; readSavedReview?: ReadSavedReview; children: ReactNode;
}) {
  const language = useLanguage();
  const files = useContext(ChatFileContext);
  const resource = useMemo(() => files ? (target: FilePreviewTarget) =>
    chatBrowserResource(target.path, { ...files, threadId: target.threadId }, target.line) : null, [files]);
  // Refresh memoized diff content when the language changes without resetting the review state.
  const translate = useMemo<DiffTranslate>(() => (source, values) => displayText(source, values), [language]);
  return <DiffTextContext.Provider value={translate}>
    <RemoteBrowserResourceContext.Provider value={resource}>
    <DetailsWorkspace selected={selected} active={active} enabled={enabled} readSavedReview={readSavedReview}
      renderRemoteFile={files ? props => <ChatRemoteFilePreview {...props} context={files}
        key={`${props.target.threadId}:${props.target.path}:${props.target.line ?? ''}`} /> : undefined}
      className="chat-diff-workspace" contentClassName="chat-diff-layout">
      <MobileChatBrowser active={active} readSavedReview={readSavedReview}>{children}</MobileChatBrowser>
    </DetailsWorkspace>
    </RemoteBrowserResourceContext.Provider>
  </DiffTextContext.Provider>;
}
