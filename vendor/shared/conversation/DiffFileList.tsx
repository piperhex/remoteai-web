import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, FileDiff, Folder } from 'lucide-react';
import { groupDiffFiles } from '../chat/diffGroups';
import { useDiffText } from '../chat/diffText';
import type { DiffFile } from './diff';
import styles from './DiffView.module.less';

type FileInfo = Pick<DiffFile, 'path' | 'previousPath' | 'kind'> & Partial<Pick<DiffFile, 'added' | 'removed'>>;
const KIND_LABELS: Record<string, string> = {
  add: 'client.git.added', delete: 'client.projectBrowser.deleted', update: 'client.git.modified',
};

function Counts({ added, removed }: Pick<FileInfo, 'added' | 'removed'>) {
  const t = useDiffText();
  if (added === undefined || removed === undefined) return null;
  return <span className={styles.counts} aria-label={t('client.chat.linesAddedLinesRemoved', { added, removed })}>
    <span className={styles.added}>+{added}</span><span className={styles.removed}>−{removed}</span>
  </span>;
}

function FileCard({ file, initialOpen, scrollTo, children }: {
  file: FileInfo; initialOpen: boolean; scrollTo: boolean; children: ReactNode;
}) {
  const t = useDiffText();
  const [open, setOpen] = useState(initialOpen);
  const header = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (scrollTo) header.current?.scrollIntoView?.({ block: 'nearest' }); }, [scrollTo]);
  const label = file.previousPath ? 'client.projectBrowser.renamed' : KIND_LABELS[file.kind] ?? 'client.git.modified';
  return <section className={styles.file}>
    <button type="button" ref={header} className={styles.fileHeader} aria-expanded={open} onClick={() => setOpen(!open)}>
      <FileDiff size={15} /><span className={styles.path} title={file.path}>{file.path.split(/[\\/]/).pop()}</span>
      <span className={styles.kind}>{t(label)}</span><Counts added={file.added} removed={file.removed} />
      <ChevronDown size={14} className={open ? styles.rotated : undefined} />
    </button>
    {open && children}
  </section>;
}

export function DiffModeButtons({ split, setSplit }: { split: boolean; setSplit: (value: boolean) => void }) {
  const t = useDiffText();
  return <div className={styles.modes} role="group" aria-label={t('client.chat.diffDisplayMode')}>
    <button type="button" aria-pressed={!split} onClick={() => setSplit(false)}>{t('client.chat.unified')}</button>
    <button type="button" aria-pressed={split} onClick={() => setSplit(true)}>{t('client.chat.sideBySide')}</button>
  </div>;
}

export function DiffFileList({ files, title, status, continuous, initialFile, selectedFile, complete = true, renderBody }: {
  files: readonly FileInfo[]; title: string; status?: string; continuous?: boolean;
  initialFile?: number | 'all'; selectedFile?: number; complete?: boolean;
  renderBody: (index: number, split: boolean) => ReactNode;
}) {
  const t = useDiffText();
  const [split, setSplit] = useState(false);
  const groups = useMemo(() => groupDiffFiles(files), [files]);
  const totals = useMemo(() => {
    const count = new Set(files.map(file => file.path)).size;
    let added = 0, removed = 0;
    for (const file of files) {
      if (file.added === undefined || file.removed === undefined) return { count };
      added += file.added;
      removed += file.removed;
    }
    return { count, added, removed };
  }, [files]);
  if (!files.length) return null;
  return <div className={`${styles.diff} ${continuous ? styles.continuous : ''}`}>
    <div className={styles.toolbar}><strong>{t(title)}</strong>
      {complete && <><span>{t('client.chat.files', { count: totals.count })}</span><Counts {...totals} /></>}
      {status && <span role="status">{t(status)}</span>}
      <DiffModeButtons split={split} setSplit={setSplit} />
    </div>
    {groups.map(group => <section key={group.directory} className={styles.folderGroup}
      aria-label={group.directory || t('client.runtimeErrors.rootFolder')}>
      <header className={styles.folderHeader}>
        <Folder size={16} aria-hidden="true" />
        <div className={styles.folderInfo}>
          <h3 className={styles.folderName}>{group.directory && group.directory !== '/'
            ? group.name : t('client.runtimeErrors.rootFolder')}</h3>
          <p className={styles.folderPath}>{group.directory || '.'}</p>
        </div>
      </header>
      {group.entries.map(({ file, index }) => <FileCard key={`${file.path}:${index}`} file={file}
        initialOpen={initialFile === 'all' || index === initialFile} scrollTo={index === selectedFile}>
        {renderBody(index, split)}
      </FileCard>)}
    </section>)}
  </div>;
}
