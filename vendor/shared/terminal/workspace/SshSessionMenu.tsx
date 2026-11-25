import { Button, Dropdown } from 'antd';
import { useRef, useState } from 'react';
import { Plus, Server } from 'lucide-react';
import { displayText as t } from '../../localization/messages';
import { sshLabel, type SshProfile } from '../sshProfiles';
import type { ChatComputer } from '../../remote-chat/devices';
import type { SshHostDirectory } from './useSshHosts';
import { useSshComputerMenu } from './SshComputerMenu';

export function SshSessionMenu({ profiles, canConnect, directory, create, connect }: {
  profiles: SshProfile[]; canConnect: boolean; directory: SshHostDirectory;
  create: () => void; connect: (profile: SshProfile, device: ChatComputer) => void;
}) {
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const trigger = useRef<HTMLButtonElement>(null);
  const [placement, setPlacement] = useState<'bottomLeft' | 'bottomRight'>('bottomLeft');
  const computers = useSshComputerMenu(directory);
  return <Dropdown trigger={['click']} autoFocus placement={placement} overlayClassName="ssh-launch-menu"
    onOpenChange={open => {
      setOpenKeys([]);
      if (open && trigger.current) {
        // Align the profile menu inward to leave space beside it for the computers.
        const rightHalf = trigger.current.getBoundingClientRect().left > window.innerWidth / 2;
        setPlacement(rightHalf ? 'bottomRight' : 'bottomLeft');
      }
    }}
    menu={{ 'aria-label': t('client.ssh.menu'), className: 'sshw-session-menu', triggerSubMenuAction: 'click',
      openKeys, onOpenChange: keys => { computers.reset(); setOpenKeys(keys.slice(-1)); }, items: [
      { key: 'new', icon: <Plus size={15} />, label: t('client.ssh.createTitle'), onClick: create },
      ...(profiles.length ? [{ type: 'divider' as const }] : []),
      ...profiles.map(profile => ({
        key: 'profile:' + profile.id, icon: <Server size={15} />, disabled: !canConnect,
        popupClassName: 'sshw-computer-menu', popupOffset: [4, 0],
        children: openKeys.includes('profile:' + profile.id)
          ? computers.items(profile.id, device => connect(profile, device)) : [],
        label: <span className="sshw-session-label">{profile.name || sshLabel(profile)}
          {profile.name && <small>{sshLabel(profile)}</small>}</span>,
      })),
    ] }}>
    <Button ref={trigger} type="text" icon={<Plus size={15} />} title={t('client.ssh.menu')}
      aria-label={t('client.ssh.menu')} aria-haspopup="menu" />
  </Dropdown>;
}
