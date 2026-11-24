import { useEffect, useMemo, useState } from 'react';
import { Button, Spin } from 'antd';
import { ChevronDown, ChevronRight, FileDiff } from 'lucide-react';
import { parseFileChange, parseUnifiedDiff } from '../chat/diffParser';
import { useDiffText } from '../chat/diffText';
import { remoteErrorText } from '../localization/errors';
import { DiffContent } from './DiffDocument';
import type { ReadSavedReview, SavedReviewFile, SavedReviewTarget } from './savedReview';
import styles from './ChangesReview.module.less';

interface Props { read: ReadSavedReview; threadId: string; turnId: string; activity?: boolean }
function fileInfo(file: SavedReviewFile) {
  if (file.header) return parseUnifiedDiff(file.header)[0];
  return { path: file.kind?.movePath ?? file.path ?? '', kind: file.kind?.type ?? 'update' };
}

function usePage(read: ReadSavedReview, target: SavedReviewTarget) {
  const [offset, setOffset] = useState(0);
  const [attempt, retry] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [next, setNext] = useState<number | null>();
  const [files, setFiles] = useState<SavedReviewFile[]>([]);
  const [text, setText] = useState('');
  const { threadId, turnId, activity, file } = target;
  useEffect(() => {
    let current = true;
    setBusy(true); setError('');
    read({ threadId, turnId, activity, file, offset }).then(page => {
      if (!current) return;
      const { files, text } = page;
      if (files) setFiles(old => offset ? [...old, ...files] : files);
      if (typeof text === 'string') setText(old => offset ? old + text : text);
      setNext(page.next); setBusy(false);
    }).catch(cause => { if (current) { setError(remoteErrorText(String(cause))); setBusy(false); } });
    return () => { current = false; };
  }, [read, threadId, turnId, activity, file, offset, attempt]);
  const more = error ? () => retry(value => value + 1) : next != null ? () => setOffset(next) : undefined;
  return { text, files, busy, error, more };
}

function PageControls({ busy, error, more }: ReturnType<typeof usePage>) {
  const t = useDiffText();
  if (busy) return <Spin size="small" />;
  return <>{error && <p role="alert">{error}</p>}{more && <Button size="small" onClick={more}>
    {t(error ? 'client.lounge.historyRetry' : 'client.chat.loadMore')}</Button>}</>;
}

function SavedBody({ read, target, entry }: { read: ReadSavedReview; target: SavedReviewTarget; entry: SavedReviewFile }) {
  const page = usePage(read, target);
  const file = useMemo(() => {
    const info = fileInfo(entry);
    return parseFileChange({ path: info.path, kind: { type: info.kind }, diff: page.text }, Boolean(entry.header));
  }, [page.text, entry]);
  return <>{page.text && <DiffContent file={file} split={false} />}<PageControls {...page} /></>;
}

export function SavedReviewFiles({ read, threadId, turnId, activity = false }: Props) {
  const target = { threadId, turnId, activity };
  const page = usePage(read, target);
  const [open, setOpen] = useState<number>();
  return <>{page.files.map((entry, index) => <section key={index} className={styles.file}>
    <button type="button" aria-expanded={index === open} onClick={() => setOpen(index === open ? undefined : index)}>
      {index === open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<FileDiff size={16} />
      <span>{fileInfo(entry).path}</span>
    </button>
    {open === index && <SavedBody read={read} target={{ ...target, file: index }} entry={entry} />}
  </section>)}<PageControls {...page} /></>;
}

export function SavedReview({ read, threadId, turnId }: Props) {
  const t = useDiffText();
  const [activity, showActivity] = useState(false);
  return <><SavedReviewFiles read={read} threadId={threadId} turnId={turnId} />
    <details className={styles.observed} onToggle={event => showActivity(event.currentTarget.open)}>
      <summary>{t('client.chat.activity')}</summary>
      {activity && <SavedReviewFiles read={read} threadId={threadId} turnId={turnId} activity />}
    </details></>;
}
