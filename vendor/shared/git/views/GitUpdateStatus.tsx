import { Button, Spin } from 'antd';
import type { RemoteGit } from '../../remote-chat/useRemoteGit';
import { t } from '../../localization/browserClient';
import './gitUpdate.css';

export function GitUpdateStatus({ panel, connected }: { panel: RemoteGit; connected: boolean }) {
  const backup = panel.changes?.updateBackup;
  const integration = panel.changes?.integration;
  const conflicts = panel.changes?.files.filter(file => file.conflict) ?? [];
  const pendingRestore = !backup?.native && backup?.phase === 'saved';
  if (panel.updating) return <div className="git-update-status" role="status" aria-live="polite">
    <Spin size="small" /><span>{t('client.gitUpdate.progress')}</span>
  </div>;
  if (!backup) return null;
  return <div className="git-update-recovery" role="status">
    <p>{t(backup.stash ? 'client.gitUpdate.saved' : 'client.gitUpdate.checkSave')}</p>
    <details><summary>{t('client.gitUpdate.recovery')}</summary>
      <p>{t('client.gitUpdate.recoveryHint')}</p>
      {backup.stash && <code>git stash show --include-untracked --patch {backup.stash}</code>}
      {backup.stash && <><p>{t('client.gitUpdate.restoreHint')}</p>
        <code>git stash apply --index {backup.stash}</code></>}
    </details>
    {integration?.kind === 'stash' && <Button disabled={panel.busy || !connected || conflicts.length > 0}
      onClick={() => void panel.continueIntegration()}>
      {t(pendingRestore ? 'client.gitUpdate.restore' : 'client.gitUpdate.acknowledge')}</Button>}
  </div>;
}
