import { Dropdown } from 'antd';
import { Check, Pencil, Server, Trash2 } from 'lucide-react';
import { useThreadLongPress } from '../chat/useThreadLongPress';
import { displayText as t } from '../localization/messages';
import { sshLabel, type SshProfile } from './sshProfiles';

export type SshProfileAction = (action: 'edit' | 'remove', profile: SshProfile) => void;

export function SshProfileRow({ profile, selected, disabled, choose, onAction }: {
  profile: SshProfile; selected: boolean; disabled: boolean;
  choose: (profile: SshProfile) => void; onAction?: SshProfileAction;
}) {
  const gesture = useThreadLongPress(({ target, x, y }) => {
    target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  }, { enabled: !!onAction, nativeContextMenu: true });
  const card = <button type="button" className="ssh-profile-card" aria-pressed={selected}
    aria-haspopup={onAction ? 'menu' : undefined} aria-disabled={disabled}
    disabled={disabled && !onAction} onClick={() => { if (!disabled) choose(profile); }}
    {...(onAction && gesture)}>
    <span className="ssh-profile-icon"><Server size={17} aria-hidden /></span>
    <span className="ssh-profile-copy"><strong>{profile.name || profile.host}</strong>
      <small>{sshLabel(profile)}</small></span>
    {selected && <Check size={14} className="ssh-profile-check" aria-hidden />}
  </button>;
  if (!onAction) return card;
  return <Dropdown trigger={['contextMenu']} autoFocus menu={{ items: [
    { key: 'edit', icon: <Pencil size={15} />, label: t('client.chat.edit.051836'),
      onClick: () => onAction('edit', profile) },
    { key: 'remove', icon: <Trash2 size={15} />, label: t('client.ssh.removeSaved'), danger: true,
      onClick: () => onAction('remove', profile) },
  ] }}>{card}</Dropdown>;
}
