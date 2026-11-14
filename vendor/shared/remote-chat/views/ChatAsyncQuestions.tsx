import { displayError } from '../../localization/browserClient';
import { t, useLanguage } from '../../localization/browserClient';
import { useRef, useState } from 'react';
import { MessageCircle, Trash2 } from 'lucide-react';
import { Button, Input, Radio } from 'antd';
import { AdaptiveSheet } from '../../layout/AdaptiveSheet';
import { submitQuestionOnEnter } from '../../conversation/questionKeyboard';
import { pendingQuestions } from '../client/asyncQuestions';
import type { Item, Thread } from './types';
import { useDismissedQuestions } from './useDismissedQuestions';
import { QuestionPager } from '../../conversation/questions/QuestionPager';
import type { DictationClient } from '../../chat/dictation/client';
import { useDesktopLayout } from '../../layout/useDesktopLayout';
import './asyncQuestions.css';

interface Props {
  thread: Thread | null; disabled: boolean; error: string;
  scope: string;
  active?: boolean;
  paginated?: boolean;
  dictation?: DictationClient;
  answer: (item: Item, answers: string[]) => Promise<boolean>;
}
function QuestionFields({ questions, answers, disabled, update }: {
  questions: NonNullable<Item['questions']>; answers: string[]; disabled: boolean;
  update: (index: number, value: string) => void;
}) {
  return <>{questions.map((question, index) => <fieldset key={index} className="chat-question" disabled={disabled}>
    <legend>{question.title}</legend>
    {!!question.options?.length && <Radio.Group className="chat-question-options" value={answers[index]}
      disabled={disabled} onChange={event => update(index, event.target.value)}>
      {question.options.map((option, position) => <Radio key={position} value={option}>{option}</Radio>)}
    </Radio.Group>}
    <Input.TextArea aria-label={question.title}
      placeholder={t("client.composer.typeYourAnswerAndPressEnterToSend")} autoFocus={index === 0}
      autoSize={{ minRows: 3, maxRows: 8 }} disabled={disabled}
      value={answers[index] ?? ''} onChange={event => update(index, event.target.value)} />
  </fieldset>)}</>;
}
function QuestionCard({ item, disabled, error, answer, onDelete }: Omit<Props, 'thread' | 'scope'> & {
  item: Item; onDelete: () => void;
}) {
  useLanguage();
  const questions = item.questions ?? [];
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState(() => questions.map(question => question.options?.[0] ?? ''));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const submitting = useRef(false);
  const submit = async () => {
    if (submitting.current || disabled || answers.some(value => !value.trim())) return;
    submitting.current = true; setBusy(true); setFailure('');
    try {
      if (await answer(item, answers)) setOpen(false);
      else setFailure(t("client.chat.yourAnswerHasNotBeenConfirmedCheckItsProgressOr"));
    } catch { setFailure(t("client.chat.couldNotSendYourAnswerPleaseTryAgain")); }
    finally { submitting.current = false; setBusy(false); }
  };
  const update = (index: number, value: string) => setAnswers(previous =>
    previous.map((entry, position) => position === index ? value : entry));
  return <>
    <div className="chat-question-entry">
      <button type="button" className="chat-question-open" onClick={() => setOpen(true)}
        aria-label={t("client.chat.answerFollowUpQuestion", { value1: questions[0]?.title ?? '' })}><MessageCircle size={19} />
        <span className="chat-grow"><strong>{t("client.chat.moreInformationNeeded")}</strong><small className="chat-ellipsis">
          {questions[0]?.title}</small></span><span>{t("client.chat.answer")}</span></button>
      <button type="button" className="chat-question-delete" aria-label={t("client.chat.dismissFollowUpQuestion", { value1: questions[0]?.title ?? '' })}
        disabled={busy} onClick={onDelete}><Trash2 size={16} /></button>
    </div>
    {open && <AdaptiveSheet open title={t("client.chat.moreInformationNeeded")} width={560}
      className="chat-question-sheet" titleIcon={<MessageCircle className="chat-question-icon" size={20} />}
      onClose={() => { if (!busy) setOpen(false); }}>
      <form className="chat-question-form" aria-busy={busy}
        onSubmit={event => { event.preventDefault(); void submit(); }}>
        <div className="chat-question-fields" onKeyDown={event => submitQuestionOnEnter(event, submit)}>
          <QuestionFields questions={questions} answers={answers} disabled={disabled || busy} update={update} />
        </div>
        {(error || failure) && <p role="alert" className="chat-error">{error || failure}</p>}
        <div className="chat-question-footer">
          <small>{t("client.chat.enterToSendShiftEnterForANewLine")}</small>
          <div className="chat-question-actions">
            <Button disabled={busy} onClick={() => {
              if (!submitting.current) { setOpen(false); onDelete(); }
            }}>{t("client.downloads.cancelAnswer")}</Button>
            <Button htmlType="submit" type="primary" loading={busy}
              disabled={busy || disabled || answers.some(value => !value.trim())}>
              {busy ? t("client.imageAi.submitting") : t("client.chat.submitAnswer")}</Button>
          </div>
        </div>
      </form>
    </AdaptiveSheet>}
  </>;
}
export function ChatAsyncQuestions({ thread, scope, ...props }: Props) {
  useLanguage();
  const desktop = useDesktopLayout();
  const { dismissed, dismiss, error } = useDismissedQuestions(scope);
  const questionKey = (item: Item) => JSON.stringify([thread?.id, item.id]);
  const questions = pendingQuestions(thread).filter(item => !dismissed.has(questionKey(item)));
  if (!questions.length) return null;
  const paginated = props.paginated ?? desktop;
  return <div className={`chat-async-questions chat-scroll${paginated ? ' chat-question-pager' : ''}`}>
    {paginated ? <QuestionPager key={JSON.stringify([scope, thread?.id])} items={questions}
      disabled={props.disabled} active={props.active} dictation={props.dictation} onAnswer={props.answer}
      onDismiss={item => dismiss(questionKey(item))} />
      : questions.map(item => <QuestionCard key={questionKey(item)} item={item} {...props}
        onDelete={() => dismiss(questionKey(item))} />)}
    {error && <p role="alert" className="chat-error">{displayError(error)}</p>}
  </div>;
}
