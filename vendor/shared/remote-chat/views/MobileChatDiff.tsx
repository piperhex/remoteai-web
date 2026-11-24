import { useDiffText } from '../../chat/diffText';
import { WorkspaceDrawerContext } from '../../chat/workspaceDrawer';
import { DetailsContext, type DiffPanelEntry } from '../../conversation/detailsContext';
import { SavedReview } from '../../conversation/SavedReviewFiles';
import type { ReadSavedReview } from '../../conversation/savedReview';
import { AdaptiveSheet } from '../../layout/AdaptiveSheet';
import { ChatDiff } from './ChatDiff';

export function MobileChatDiff({ entry, readSavedReview, onClose }: {
  entry: DiffPanelEntry; readSavedReview?: ReadSavedReview; onClose: () => void;
}) {
  const t = useDiffText();
  const turn = entry.turnReview;
  const files = entry.filePath ? entry.files.filter(file => file.path === entry.filePath) : entry.files;
  // Render the diff itself in the phone drawer instead of another review launcher.
  return <WorkspaceDrawerContext.Provider value={null}><DetailsContext.Provider value={null}>
    <AdaptiveSheet open presentation="drawer" title={t(entry.title)} onClose={onClose}>
      {files.length > 0 && <ChatDiff files={files} status={entry.status} />}
      {turn?.deferred && readSavedReview && turn.threadId && turn.turnId
        ? <SavedReview key={JSON.stringify([turn.threadId, turn.turnId])} read={readSavedReview}
          threadId={turn.threadId} turnId={turn.turnId} />
        : !files.length && turn && <p>{t('client.changeReview.' + (turn.deferred ? 'incomplete' : turn.result))}</p>}
    </AdaptiveSheet>
  </DetailsContext.Provider></WorkspaceDrawerContext.Provider>;
}
