import type { ReactElement } from 'react';
import { Dropdown } from 'antd';
import { Check, ChevronRight, Pencil, Server, Trash2 } from 'lucide-react';
import { useThreadLongPress } from '../chat/useThreadLongPress';
import { displayText as t } from '../localization/messages';
import { sshLabel, type SshProfile } from './sshProfiles';

export type SshProfileAction = (action: 'edit' | 'remove', profile: SshProfile) => void;
export type SshProfilePicker = (profile: SshProfile, trigger: ReactElement) => ReactElement;

export function SshProfileRow({ profile, selected, disabled, choose, onAction, renderPicker }: {
  profile: SshProfile; selected: boolean; disabled: boolean;
  choose: (profile: SshProfile) => void; onAction?: SshProfileAction; renderPicker?: SshProfilePicker;
}) {
  const gesture = useThreadLongPress(({ target, x, y }) => {
    target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  }, { enabled: !!onAction, nativeContextMenu: true });
  const card = <button type="button" className="ssh-profile-card" aria-pressed={renderPicker ? undefined : selected}
    aria-haspopup={onAction ? 'menu' : undefined} aria-disabled={disabled}
    disabled={disabled && !onAction} onClick={() => { if (!disabled && !renderPicker) choose(profile); }}
    {...(onAction && gesture)}>
    <span className="ssh-profile-icon"><Server size={17} aria-hidden /></span>
    <span className="ssh-profile-copy"><strong>{profile.name || profile.host}</strong>
      <small>{sshLabel(profile)}</small></span>
    {renderPicker ? <ChevronRight size={15} className="sshw-profile-arrow" aria-hidden />
      : selected && <Check size={14} className="ssh-profile-check" aria-hidden />}
  </button>;
  const trigger = renderPicker?.(profile, card) ?? card;
  if (!onAction) return trigger;
  return <Dropdown trigger={['contextMenu']} autoFocus menu={{ items: [
    { key: 'edit', icon: <Pencil size={15} />, label: t('client.chat.edit.051836'),
      onClick: () => onAction('edit', profile) },
    { key: 'remove', icon: <Trash2 size={15} />, label: t('client.ssh.removeSaved'), danger: true,
      onClick: () => onAction('remove', profile) },
  ] }}><div>{trigger}</div></Dropdown>;
}
