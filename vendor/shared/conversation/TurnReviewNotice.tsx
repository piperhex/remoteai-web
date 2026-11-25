import { useContext, useMemo, type ReactNode } from 'react';
import { DetailsContext, type TurnReview } from './detailsContext';
import { useDiffText } from '../chat/diffText';
import { SavedReviewSummary } from './SavedReviewSummary';

export function TurnReviewNotice({ review, actions, localFiles, status }: {
  review: TurnReview; actions?: ReactNode; localFiles?: boolean; status?: string;
}) {
  const t = useDiffText();
  const panel = useContext(DetailsContext);
  const entry = useMemo(() => ({ id: JSON.stringify([review.threadId, review.turnId, review.cwd]),
    title: 'client.chat.changesThisTurn', files: [], turnReview: review }), [review]);
  const { threadId, turnId, result } = review;
  if (review.deferred && result !== 'empty' && panel?.readSavedReview && threadId && turnId) {
    return <SavedReviewSummary key={entry.id} read={panel.readSavedReview} target={{ threadId, turnId }}
      entry={entry} open={panel.open} actions={actions} localFiles={localFiles} status={status} />;
  }
  const text = t(result === 'net' ? entry.title : 'client.changeReview.' + result);
  return <>{panel ? <button type="button" className="chat-text-action" onClick={() => panel.open(entry)}>{text}</button>
    : <p>{text}</p>}{actions}</>;
}
