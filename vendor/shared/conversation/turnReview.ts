import type { Turn } from './types';
import type { TurnReview } from './detailsContext';
import { processOutputs } from './processDetails';

export function turnReview(turn?: Turn, threadId?: string): TurnReview {
  const prompt = turn?.items.find(item => item.type === 'userMessage')?.content?.[0];
  const summary = typeof prompt === 'string' ? prompt : prompt?.text;
  const edits = (turn?.reviewEdits?.length ? turn.reviewEdits : processOutputs(turn?.items ?? []))
    .filter(item => item.type === 'fileChange');
  const toolEdits = edits.some(item => item.type === 'fileChange'
    && (!item.status || item.status === 'completed') && item.changes?.length);
  let result: TurnReview['result'] = 'incomplete';
  if (!turn?.reviewIncomplete && typeof turn?.diff === 'string') result = turn.diff.trim() ? 'net' : 'empty';
  else if (!turn?.reviewIncomplete && toolEdits) result = 'tools';
  return { threadId, turnId: turn?.id, cwd: turn?.reviewCwd, summary: summary?.slice(0, 100),
    result: turn?.reviewDeferred ?? result, deferred: Boolean(turn?.reviewDeferred),
    observation: turn?.workspaceObservation, activity: edits.map(item => (item.changes ?? []).map(change => change.path)) };
}
