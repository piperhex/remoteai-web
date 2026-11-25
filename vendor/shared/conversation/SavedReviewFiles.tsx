import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Spin } from 'antd';
import { ChevronDown, ChevronRight, FileDiff } from 'lucide-react';
import { parseFileChange, parseUnifiedDiff } from '../chat/diffParser';
import { useDiffText } from '../chat/diffText';
import { remoteErrorText } from '../localization/errors';
import { DiffContent } from './DiffDocument';
import { DiffFileList, DiffModeButtons } from './DiffFileList';
import type { DiffFile } from '../chat/diff';
import type { ReadSavedReview, SavedReviewFile, SavedReviewTarget } from './savedReview';
import styles from './ChangesReview.module.less';

type RenderDiff = (file: DiffFile) => ReactNode;
interface Props { read: ReadSavedReview; threadId: string; turnId: string; activity?: boolean; renderDiff?: RenderDiff }
export function fileInfo(file: SavedReviewFile): Pick<DiffFile, 'path' | 'previousPath' | 'kind'> {
  const header = file.header && parseUnifiedDiff(file.header)[0];
  return header || { path: file.kind?.movePath ?? file.path ?? '', kind: file.kind?.type ?? 'update',
    previousPath: file.kind?.movePath ? file.path : undefined };
}

export function useSavedReviewPage(read: ReadSavedReview | undefined, target: SavedReviewTarget) {
  const [offset, setOffset] = useState(0);
  const [attempt, retry] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [next, setNext] = useState<number | null>();
  const [files, setFiles] = useState<SavedReviewFile[]>([]);
  const [text, setText] = useState('');
  const { threadId, turnId, activity, file } = target;
  useEffect(() => {
    if (!read) return;
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
  return { text, files, busy, error, more, next };
}

export function PageControls({ busy, error, more }: ReturnType<typeof useSavedReviewPage>) {
  const t = useDiffText();
  if (busy) return <Spin size="small" />;
  return <>{error && <p role="alert">{error}</p>}{more && <Button size="small" onClick={more}>
    {t(error ? 'client.lounge.historyRetry' : 'client.chat.loadMore')}</Button>}</>;
}

function SavedBody({ read, target, entry, renderDiff }: {
  read: ReadSavedReview; target: SavedReviewTarget; entry: SavedReviewFile; renderDiff?: RenderDiff;
}) {
  const page = useSavedReviewPage(read, target);
  const file = useMemo(() => {
    const info = fileInfo(entry);
    return parseFileChange({ path: info.previousPath ?? info.path, kind: {
      type: info.kind, movePath: info.previousPath ? info.path : undefined }, diff: page.text }, Boolean(entry.header));
  }, [page.text, entry]);
  const loaded = Boolean(page.text) || (!page.busy && !page.error);
  return <>{loaded && (renderDiff ? renderDiff(file) : <DiffContent file={file} split={false} />)}
    <PageControls {...page} /></>;
}

export function SavedReviewFiles({ read, threadId, turnId, activity = false, selectedFile, renderDiff }:
  Props & { selectedFile?: number }) {
  const target = { threadId, turnId, activity };
  const page = useSavedReviewPage(read, target);
  const [open, setOpen] = useState(selectedFile);
  const selected = useRef<HTMLButtonElement>(null);
  const reached = selectedFile !== undefined && selectedFile < page.files.length;
  useEffect(() => {
    if (!reached && selectedFile !== undefined && !page.busy && !page.error) page.more?.();
  }, [selectedFile, reached, page.busy, page.error, page.more]);
  useEffect(() => { if (reached) selected.current?.scrollIntoView?.({ block: 'nearest' }); }, [reached]);
  return <>{page.files.map((entry, index) => <section key={index} className={styles.file}>
    <button type="button" aria-expanded={index === open} ref={index === selectedFile ? selected : undefined}
      onClick={() => setOpen(index === open ? undefined : index)}>
      {index === open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<FileDiff size={16} />
      <span>{fileInfo(entry).path}</span>
    </button>
    {open === index && <SavedBody read={read} target={{ ...target, file: index }} entry={entry} renderDiff={renderDiff} />}
  </section>)}<PageControls {...page} /></>;
}

export function SavedReviewDocument({ read, threadId, turnId, selectedFile, status }:
  Pick<Props, 'read' | 'threadId' | 'turnId'> & { selectedFile?: number; status?: string }) {
  const page = useSavedReviewPage(read, { threadId, turnId });
  const files = useMemo(() => page.files.map(entry => ({
    ...fileInfo(entry), added: entry.added, removed: entry.removed,
  })), [page.files]);
  useEffect(() => {
    if (!page.busy && !page.error && page.next != null) page.more?.();
  }, [page.busy, page.error, page.next, page.more]);
  return <><DiffFileList files={files} title="client.chat.changesThisTurn" status={status} continuous
    complete={!page.busy && !page.error && page.next == null} initialFile={selectedFile ?? 0} selectedFile={selectedFile}
    renderBody={(index, split) => <SavedBody read={read} target={{ threadId, turnId, file: index }}
      entry={page.files[index]} renderDiff={file => <DiffContent file={file} split={split} />} />} />
    <PageControls {...page} /><SavedActivity read={read} threadId={threadId} turnId={turnId} /></>;
}

function SavedActivity({ read, threadId, turnId }: Props) {
  const t = useDiffText();
  const [activity, showActivity] = useState(false);
  return <details className={styles.observed} onToggle={event => showActivity(event.currentTarget.open)}>
      <summary>{t('client.chat.activity')}</summary>
      {activity && <SavedReviewFiles read={read} threadId={threadId} turnId={turnId} activity />}
  </details>;
}

export function SavedReview({ read, threadId, turnId, selectedFile }: Props & { selectedFile?: number }) {
  const [split, setSplit] = useState(false);
  return <><DiffModeButtons split={split} setSplit={setSplit} />
    <SavedReviewFiles read={read} threadId={threadId} turnId={turnId} selectedFile={selectedFile}
      renderDiff={file => <DiffContent file={file} split={split} />} />
    <SavedActivity read={read} threadId={threadId} turnId={turnId} /></>;
}
