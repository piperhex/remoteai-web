import { Button, Dropdown } from 'antd';
import { Plus, Server } from 'lucide-react';
import { displayText as t } from '../../localization/messages';
import { sshLabel, type SshProfile } from '../sshProfiles';

export function SshSessionMenu({ profiles, canConnect, choose }: {
  profiles: SshProfile[]; canConnect: boolean; choose: (profile?: SshProfile) => void;
}) {
  return <Dropdown trigger={['click']} autoFocus placement="bottomLeft" overlayClassName="ssh-launch-menu"
    menu={{ 'aria-label': t('client.ssh.menu'), className: 'sshw-session-menu', items: [
      { key: 'new', icon: <Plus size={15} />, label: t('client.ssh.createTitle'), onClick: () => choose() },
      ...(profiles.length ? [{ type: 'divider' as const }] : []),
      ...profiles.map(profile => ({
        key: 'profile:' + profile.id, icon: <Server size={15} />, disabled: !canConnect, onClick: () => choose(profile),
        label: <span className="sshw-session-label">{profile.name || sshLabel(profile)}
          {profile.name && <small>{sshLabel(profile)}</small>}</span>,
      })),
    ] }}>
    <Button type="text" icon={<Plus size={15} />} title={t('client.ssh.menu')}
      aria-label={t('client.ssh.menu')} aria-haspopup="menu" />
  </Dropdown>;
}
