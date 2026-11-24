import { useContext, useMemo } from 'react';
import { DetailsContext, type TurnReview } from './detailsContext';
import { useDiffText } from '../chat/diffText';

export function TurnReviewNotice({ review }: { review: TurnReview }) {
  const t = useDiffText();
  const panel = useContext(DetailsContext);
  const entry = useMemo(() => ({ id: JSON.stringify([review.threadId, review.turnId, review.cwd]),
    title: 'client.chat.changesThisTurn', files: [], turnReview: review }), [review]);
  const text = t(review.deferred ? 'client.chat.changesThisTurn' : 'client.changeReview.' + review.result);
  return panel ? <button type="button" className="chat-text-action" onClick={() => panel.open(entry)}>{text}</button>
    : <p>{text}</p>;
}
