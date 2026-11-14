import { useRef, useState } from 'react';
import { displayText as text } from '../../localization/messages';
import type { Item } from '../types';

export interface QuestionPage {
  key: string;
  item: Item;
  index: number;
  question: NonNullable<Item['questions']>[number];
}
export interface AnswerDraft { selected: string; reply: string }
export interface QuestionPagerOptions {
  items: Item[];
  disabled?: boolean;
  onAnswer: (item: Item, answers: string[]) => Promise<boolean>;
  onDismiss: (item: Item) => void;
}
const pageKey = (item: Item, index: number) => JSON.stringify([item.id, index]);

/** Keep drafts attached to question identities as requests arrive or disappear. */
export function useQuestionPager({ items, disabled, onAnswer, onDismiss }: QuestionPagerOptions) {
  const [drafts, setDrafts] = useState<Record<string, AnswerDraft>>({});
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [submitted, setSubmitted] = useState<Set<string>>(() => new Set());
  const [selectedKey, select] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const submitting = useRef(false);
  const pages = items.filter(item => !submitted.has(item.id)).flatMap(item =>
    (item.questions ?? []).map((question, index) => ({ item, question, index, key: pageKey(item, index) })))
    .filter(page => !skipped.has(page.key));
  const position = Math.max(0, pages.findIndex(page => page.key === selectedKey));
  const page = pages[position];
  const draftFor = (entry: QuestionPage): AnswerDraft => drafts[entry.key]
    ?? { selected: entry.question.options?.[0] ?? '', reply: '' };
  const draft = page ? draftFor(page) : { selected: '', reply: '' };
  const move = (index: number) => { if (!busy && pages[index]) { select(pages[index].key); setFailure(''); } };
  const update = (value: Partial<AnswerDraft>) => {
    if (!page) return;
    setDrafts(previous => ({ ...previous, [page.key]: { ...draft, ...value } }));
    setFailure('');
  };
  const append = (value: string) => {
    if (!page) return;
    setDrafts(previous => {
      const current = previous[page.key] ?? draft;
      return { ...previous, [page.key]: { selected: '',
        reply: [current.reply.trimEnd(), value.trim()].filter(Boolean).join('\n') } };
    });
  };
  const dismiss = () => { if (page && !busy) onDismiss(page.item); };
  const skip = () => {
    if (!page || busy) return;
    const next = new Set(skipped).add(page.key);
    setSkipped(next); setFailure('');
    select((pages[position + 1] ?? pages[position - 1])?.key ?? '');
    if (page.item.questions?.every((_, index) => next.has(pageKey(page.item, index)))) onDismiss(page.item);
  };
  const later = page && pages.find(entry => entry.item.id === page.item.id && entry.index > page.index);
  const canSubmit = Boolean((draft.reply.trim() || draft.selected) && !disabled && !busy);
  const submit = async () => {
    if (!page || !canSubmit || submitting.current) return;
    if (later) { select(later.key); return; }
    const unanswered = pages.find(entry => entry.item.id === page.item.id
      && !(draftFor(entry).reply.trim() || draftFor(entry).selected));
    if (unanswered) { select(unanswered.key); return; }
    const answers = (page.item.questions ?? []).map((question, index) => {
      const key = pageKey(page.item, index);
      if (skipped.has(key)) return text('client.questions.skippedAnswer');
      const value = draftFor({ item: page.item, question, index, key });
      return value.reply.trim() ? value.reply : value.selected;
    });
    submitting.current = true; setBusy(true); setFailure('');
    try {
      if (await onAnswer(page.item, answers)) setSubmitted(previous => new Set(previous).add(page.item.id));
      else setFailure('client.chat.yourAnswerHasNotBeenConfirmedCheckItsProgressOr');
    } catch { setFailure('client.chat.couldNotSendYourAnswerPleaseTryAgain'); }
    finally { submitting.current = false; setBusy(false); }
  };
  return { page, pages, position, draft, busy, failure, move, update, append, skip, dismiss,
    submit, canSubmit, hasNext: Boolean(later) };
}
