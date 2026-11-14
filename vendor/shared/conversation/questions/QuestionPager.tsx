import { useRef, useState } from 'react';
import { Button, Input, theme } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { ChevronLeft, ChevronRight, CircleHelp, Pencil, X } from 'lucide-react';
import { displayText as text } from '../../localization/messages';
import { useLanguage } from '../../localization/browserLanguage';
import { guiFontStyle, useGuiFontSize } from '../../appearance/fontSize';
import { ComposerDictation } from '../../chat/dictation/ComposerDictation';
import type { DictationClient } from '../../chat/dictation/client';
import { submitQuestionOnEnter } from '../questionKeyboard';
import { useQuestionPager, type QuestionPagerOptions } from './useQuestionPager';
import styles from './QuestionPager.module.less';

export interface QuestionPagerProps extends QuestionPagerOptions {
  active?: boolean;
  dictation?: DictationClient;
}

export function QuestionPager({ active = true, dictation, ...props }: QuestionPagerProps) {
  useLanguage();
  const state = useQuestionPager(props);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const input = useRef<TextAreaRef>(null);
  const fontSize = useGuiFontSize();
  const { token } = theme.useToken();
  const { page, draft, busy } = state;
  if (!page) return null;
  const locked = props.disabled || busy;
  const submit = async () => { if (!recordingBusy) await state.submit(); };
  return <section className={styles.card} aria-label={text('client.questions.title')} aria-busy={busy}
    style={{ ...guiFontStyle(fontSize), color: token.colorText, background: token.colorBgContainer,
      borderColor: token.colorBorderSecondary }}>
    <header className={styles.header}>
      <span className={styles.title}><CircleHelp size={18} />{text('client.questions.title')}</span>
      <nav className={styles.navigation} aria-label={text('client.questions.title')}>
        <Button type="text" size="small" icon={<ChevronLeft size={17} />}
          aria-label={text('client.questions.previous')} disabled={busy || state.position === 0}
          onClick={() => state.move(state.position - 1)} />
        <span className={styles.counter} aria-live="polite">
          {text('client.questions.position', { current: state.position + 1, total: state.pages.length })}</span>
        <Button type="text" size="small" icon={<ChevronRight size={17} />}
          aria-label={text('client.questions.next')} disabled={busy || state.position === state.pages.length - 1}
          onClick={() => state.move(state.position + 1)} />
        <Button type="text" size="small" icon={<X size={17} />} disabled={busy}
          aria-label={text('client.composer.closeAdditionalInformation')} onClick={state.dismiss} />
      </nav>
    </header>
    <div className={styles.body} key={page.key}>
      <p className={styles.question}>{page.question.title}</p>
      {!!page.question.options?.length && <div className={styles.options} role="radiogroup"
        aria-label={page.question.title}>
        {page.question.options.map((option, index) => <button key={index} type="button" role="radio"
          className={styles.option} aria-checked={!draft.reply.trim() && draft.selected === option}
          disabled={locked || recordingBusy} onClick={() => state.update({ selected: option, reply: '' })}>
          <span className={styles.number}>{index + 1}</span><span>{option}</span>
        </button>)}
      </div>}
    </div>
    <div className={styles.footer}>
      <div className={styles.reply}>
        <Pencil size={18} aria-hidden="true" />
        <Input.TextArea ref={input} variant="borderless" aria-label={page.question.title}
          placeholder={text('client.questions.customReply')} autoSize={{ minRows: 1, maxRows: 5 }}
          disabled={locked} value={draft.reply}
          onChange={event => state.update({ reply: event.target.value })}
          onKeyDown={event => submitQuestionOnEnter(event, submit)} />
      </div>
      <div className={styles.actions}>
        {dictation && <ComposerDictation key={page.key} client={dictation} active={active && !locked}
          disabled={!active || Boolean(locked)} onBusyChange={setRecordingBusy} onText={value => {
            state.append(value); input.current?.focus();
          }} />}
        <Button shape="round" autoInsertSpace={false} disabled={busy} onClick={state.skip}>
          {text('client.questions.skip')}</Button>
        <Button shape="round" autoInsertSpace={false} type="primary" loading={busy}
          disabled={!state.canSubmit || recordingBusy}
          onClick={() => void submit()}>
          {text(state.hasNext ? 'client.questions.next' : 'client.questions.send')}</Button>
      </div>
    </div>
    {state.failure && <p role="alert" className={styles.error}>{text(state.failure)}</p>}
  </section>;
}
