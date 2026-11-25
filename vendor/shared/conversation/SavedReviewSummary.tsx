import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { observeViewport } from '../chat/viewportObserver';
import { useDiffText } from '../chat/diffText';
import { summarizeDiffFiles } from '../chat/diffSummary';
import { EditedFilesCard } from './EditedFilesSummary';
import { FileEnvironmentContext } from './fileEnvironment';
import { FileMenu } from './FileMenu';
import { fileInfo, PageControls, useSavedReviewPage } from './SavedReviewFiles';
import type { ReadSavedReview, SavedReviewFile } from './savedReview';
import type { DiffPanelEntry } from './detailsContext';

function summarize(files: readonly SavedReviewFile[]) {
  const indices = new Map<string, number>();
  const rows = files.map((file, index) => {
    const { path } = fileInfo(file);
    if (!indices.has(path)) indices.set(path, index);
    return { path, added: file.added ?? 0, removed: file.removed ?? 0 };
  });
  // Older execution hosts return paths without counts. Keep those paths reviewable.
  const summary = files.every(file => file.added !== undefined && file.removed !== undefined)
    ? summarizeDiffFiles(rows) : { files: [...indices.keys()].map(path => ({ path })) };
  return { indices, summary };
}

export function SavedReviewSummary({ read, target, entry, open, actions, localFiles, status }: {
  read: ReadSavedReview; target: { threadId: string; turnId: string }; entry: DiffPanelEntry;
  open: (entry: DiffPanelEntry) => void; actions?: ReactNode; localFiles?: boolean; status?: string;
}) {
  const t = useDiffText();
  const environment = useContext(FileEnvironmentContext);
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (!visible && host.current) return observeViewport(host.current, near => { if (near) setVisible(true); });
  }, [visible]);
  const page = useSavedReviewPage(visible ? read : undefined, target);
  const { indices, summary } = useMemo(() => summarize(page.files), [page.files]);
  // Only metadata is paged into the card. File bodies stay on the host until opened.
  useEffect(() => {
    if (!page.busy && !page.error && page.next != null) page.more?.();
  }, [page.busy, page.error, page.next, page.more]);
  const partial = !!page.error || page.busy || page.next != null || !summary.files.length;
  const result = entry.turnReview?.result;
  return <div ref={host}><EditedFilesCard {...summary} title={entry.title} status={status} partial={partial}
    beforeReview={actions} onReview={() => open(entry)}
    renderFile={localFiles || environment ? props => <FileMenu {...props}>{props.path}</FileMenu> : undefined}
    onReviewFile={path => open({ ...entry, savedFile: indices.get(path) })}
    footer={<PageControls {...page} />} />
    {(result === 'tools' || result === 'incomplete') && <small>{t('client.changeReview.' + result)}</small>}
  </div>;
}
