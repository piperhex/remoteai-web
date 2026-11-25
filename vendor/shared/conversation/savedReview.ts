import type { FileChange, GuiEvent } from './types';

export type ReviewResult = 'empty' | 'tools' | 'incomplete' | 'net';
export interface SavedReviewTarget {
  threadId: string; turnId: string; file?: number; offset?: number; activity?: boolean;
}
export interface SavedReviewFile {
  header?: string; path?: string; kind?: FileChange['kind']; item?: string;
  added?: number; removed?: number;
}
export interface SavedReviewPage { files?: SavedReviewFile[]; text?: string; next?: number | null }
export type ReadSavedReview = (target: SavedReviewTarget) => Promise<SavedReviewPage>;

export function pagedReviewEvent(event: GuiEvent): GuiEvent {
  const turn = event.params?.turn;
  if (!turn?.savedReviewResult || event.method !== 'turn/completed') return event;
  return { ...event, params: { ...event.params, turn: { ...turn, diff: undefined, reviewEdits: [],
    reviewDeferred: turn.savedReviewResult } } };
}
