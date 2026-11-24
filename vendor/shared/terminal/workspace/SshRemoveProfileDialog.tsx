import { useState } from 'react';
import { Alert, Modal } from 'antd';
import { remoteErrorText } from '../../localization/errors';
import { displayText as t } from '../../localization/messages';
import { sshError } from '../ssh';
import { sshLabel, type SshProfile, type SshProfileStore } from '../sshProfiles';

export function SshRemoveProfileDialog({ profile, remove, close }: {
  profile: SshProfile; remove: SshProfileStore['remove']; close: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    if (pending) return;
    setPending(true); setError('');
    try { await remove(profile.id, profile.revision, profile.accountScope); close(); }
    catch (failure) { setError(sshError(failure, 'client.ssh.storageFailed')); setPending(false); }
  };
  return <Modal open centered width={400} title={t('client.ssh.removeTitle')}
    onOk={confirm} onCancel={close} confirmLoading={pending}
    okButtonProps={{ danger: true, 'aria-label': t('client.ssh.removeSaved') }}
    cancelButtonProps={{ disabled: pending, 'aria-label': t('client.ssh.cancel') }}
    maskClosable={!pending} keyboard={!pending} closable={!pending}
    okText={t('client.ssh.removeSaved')} cancelText={t('client.ssh.cancel')}>
    <strong className="sshw-profile-name">{profile.name || sshLabel(profile)}</strong>
    <p>{t('client.ssh.removeHint')}</p>
    {error && <Alert type="error" role="alert" showIcon message={remoteErrorText(error)} />}
  </Modal>;
}
