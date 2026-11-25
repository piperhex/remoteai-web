import { useEffect, useState } from 'react';
import { Button, Segmented, Spin } from 'antd';
import { ChevronDown, ChevronRight, FileDiff, RefreshCw } from 'lucide-react';
import { parseFileChange } from '../chat/diffParser';
import { useDiffText } from '../chat/diffText';
import { remoteErrorText } from '../localization/errors';
import type { GitChange, GitDiff, GitReviewScope } from '../remote-chat/gitTypes';
import { readWorkspaces, workspacePath, type GitWorkspaceState } from '../remote-chat/gitWorkspaceModel';
import { DiffContent, DiffDocument } from './DiffDocument';
import { turnReview } from './turnReview';
import { SavedReview } from './SavedReviewFiles';
import { useTurnChangedFiles } from './useTurnChangedFiles';
import type { DiffPanelEntry } from './detailsContext';
import type { Turn } from './types';
import styles from './ChangesReview.module.less';

type Workspace = NonNullable<DiffPanelEntry['workspaceReview']>;
type FileEntry = { file: GitChange; root: string; path: string };
const PAGE = 100;
const statusLabels: Record<string, string> = { A: 'client.git.added', '?': 'client.git.added',
  D: 'client.projectBrowser.deleted', R: 'client.projectBrowser.renamed', M: 'client.git.modified' };

function WorkspaceDiff({ git, row, scope }: { git: Workspace['git']; row: FileEntry; scope: GitReviewScope }) {
  const t = useDiffText();
  const [value, setValue] = useState<GitDiff>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    git.diff(row.root, row.file.path, undefined, scope).then(value => { if (active) setValue(value); })
      .catch(error => { if (active) setError(String(error)); });
    return () => { active = false; };
  }, [git, row.root, row.file.path, scope]);
  if (error) return <p role="alert">{remoteErrorText(error)}</p>;
  if (!value) return <Spin size="small" />;
  const file = parseFileChange({ path: row.path, diff: value.text, kind: { type: 'update' } }, true);
  return <>{value.truncated && <p>{t('client.git.thisDiffIsLargeOnlyPartOfItIsShown')}</p>}
    <DiffContent file={file} split={false} /></>;
}

function WorkspaceList({ workspace, scope }: { workspace: Workspace; scope: GitReviewScope }) {
  const t = useDiffText();
  const [generation, refresh] = useState(0);
  const [states, setStates] = useState<GitWorkspaceState[]>();
  const [error, setError] = useState('');
  const [open, setOpen] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const { git, cwd } = workspace;
  useEffect(() => {
    if (!cwd) return;
    let active = true;
    setStates(undefined); setError('');
    git.repository(cwd, true).then(repo => readWorkspaces(git, repo.repositories ?? [{ root: cwd, path: '', available: true }]))
      .then(value => { if (active) setStates(value); }).catch(error => { if (active) setError(String(error)); });
    return () => { active = false; };
  }, [git, cwd, generation]);
  const index = scope === 'staged' ? 0 : 1;
  const rows = states?.flatMap(({ changes, entry }) => changes.files.filter(file => file.status[index] !== ' '
    && (index === 1 || file.status !== '??')).map(file => ({ file, root: changes.root, path: workspacePath(entry, file.path) })));
  return <>
    <div className={styles.location}><span>{cwd}</span>
      {cwd && <Button type="text" size="small" aria-label={t('client.git.refreshGit')} disabled={!states && !error}
        icon={<RefreshCw size={15} />} onClick={() => refresh(value => value + 1)} />}</div>
    {error && <p role="alert">{remoteErrorText(error)}</p>}
    {(!cwd || error) && <p>{t('client.changeReview.gitScope')}</p>}
    {cwd && !rows && !error && <Spin size="small" />}
    {rows?.length === 0 && <p>{t('client.changeReview.noWorkspaceFiles')}</p>}
    {rows?.slice(0, limit).map(row => <section key={row.path} className={styles.file}>
      <button type="button" aria-expanded={open === row.path} onClick={() => setOpen(open === row.path ? '' : row.path)}>
        {open === row.path ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<FileDiff size={16} />
        <span>{row.file.originalPath && row.file.status[index] === 'R' ? row.file.originalPath + ' → ' : ''}{row.path}</span>
        <small>{t(statusLabels[row.file.status[index]] ?? 'client.git.modified')}</small>
      </button>
      {open === row.path && <WorkspaceDiff key={JSON.stringify([scope, row.file.version, generation])}
        git={git} row={row} scope={scope} />}
    </section>)}
    {rows && rows.length > limit && <Button onClick={() => setLimit(limit + PAGE)}>
      {t('client.chat.showMoreFiles', { count: rows.length - limit })}</Button>}
  </>;
}

export function ChangesReview({ entry, workspace }: { entry: DiffPanelEntry; workspace: Workspace }) {
  const t = useDiffText();
  const [view, setView] = useState<'workspace' | 'turn'>(entry.initialReview ?? 'workspace');
  const [scope, setScope] = useState<GitReviewScope>('unstaged');
  const [selected, select] = useState<Turn>();
  const available = workspace.turns ?? [];
  const historical = !entry.initialReview && selected
    ? available.find(turn => turn.id === selected.id) ?? selected : undefined;
  const historicalFiles = useTurnChangedFiles(historical);
  const turn = historical ? turnReview(historical, entry.turnReview?.threadId) : entry.turnReview;
  const files = historical ? historicalFiles : entry.files;
  return <section className={styles.review}>
    <Segmented value={view} onChange={setView} options={[
      { value: 'workspace', label: t('client.changeReview.workspace') },
      { value: 'turn', label: t('client.chat.changesThisTurn') }]} />
    {view === 'workspace' ? <>
      <div className={styles.scopes}>{(['unstaged', 'staged'] as const).map(value =>
        <Button size="small" type={scope === value ? 'default' : 'text'} key={value} aria-pressed={scope === value}
          onClick={() => setScope(value)}>{t('client.git.' + value)}</Button>)}</div>
      <WorkspaceList workspace={workspace} scope={scope} />
      {turn?.observation && <details className={styles.observed}>
        <summary>{t('client.changeReview.observed')} · {turn.turnId?.slice(0, 8)}</summary>
        <p>{t('client.changeReview.observationScope')}</p>
        {!turn.observation.complete && <p>{t('client.changeReview.observationIncomplete')}</p>}
        {turn.observation.paths.map(path => <div key={path}>{path}</div>)}
      </details>}
    </> : <>
      {!entry.initialReview && !!workspace.turns?.length && <select aria-label={t('client.chat.changesThisTurn')}
        value={turn?.turnId} onChange={event => select(available.find(turn => turn.id === event.target.value))}>
        {(historical && !available.includes(historical) ? [historical, ...available] : available).slice().reverse().map(candidate => {
          const review = turnReview(candidate);
          return <option key={candidate.id} value={candidate.id}>{review.summary} · {candidate.id.slice(0, 8)}</option>;
        })}
      </select>}
      {turn?.turnId && <div className={styles.location} title={turn.turnId}>
        <span>{turn.summary} <code>{turn.turnId.slice(0, 8)}</code>{turn.cwd && <small>{turn.cwd}</small>}</span></div>}
      {turn?.result !== 'net' && <p>{t('client.changeReview.' + (turn?.turnId ? turn.result : 'noTurn'))}</p>}
      {turn?.deferred && turn.threadId && turn.turnId && workspace.git.savedReview &&
        <SavedReview key={JSON.stringify([turn.threadId, turn.turnId, turn.cwd])} read={workspace.git.savedReview}
          threadId={turn.threadId} turnId={turn.turnId} selectedFile={entry.savedFile} />}
      {!!files.length && <DiffDocument files={files} title={entry.title} filePath={entry.filePath}
        status={entry.status} continuous initialOpen />}
      {!turn?.deferred && !!turn?.activity?.length && <details className={styles.observed}><summary>{t('client.chat.activity')}</summary>
        {turn.activity.map((paths, index) => <div key={index}>{paths.join(', ')}</div>)}</details>}
    </>}
  </section>;
}
