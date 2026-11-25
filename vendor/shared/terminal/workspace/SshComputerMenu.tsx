import { cloneElement, useState, type ReactElement } from 'react';
import { Dropdown, type MenuProps } from 'antd';
import { Laptop, Monitor } from 'lucide-react';
import { displayText as t } from '../../localization/messages';
import { remoteErrorText } from '../../localization/errors';
import { ComputerSearchBar } from '../../remote-chat/ComputerSearchBar';
import type { ChatComputer } from '../../remote-chat/devices';
import type { SshHostDirectory } from './useSshHosts';
import './computerMenu.css';

type ChooseComputer = (device: ChatComputer) => void;

export function useSshComputerMenu(directory: SshHostDirectory) {
  const [query, setQuery] = useState('');
  const items = (prefix: string, choose: ChooseComputer): NonNullable<MenuProps['items']> => {
    const keyword = query.trim().toLocaleLowerCase();
    const matches = directory.devices.filter(device => device.name.toLocaleLowerCase().includes(keyword));
    const rows = matches.map(device => {
      const local = device.deviceId === directory.localDeviceId;
      const status = local ? 'client.composer.thisComputer' : device.online ? 'client.chat.online' : 'client.chat.offline';
      return { key: prefix + ':device:' + device.deviceId, disabled: !device.online,
        icon: local ? <Laptop size={16} /> : <Monitor size={16} />, onClick: () => choose(device),
        label: <span className="sshw-computer"><span>{device.name}</span><small>{t(status)}</small></span> };
    });
    return [...rows, { key: prefix + ':footer', type: 'group', label: <>
      {!matches.length && <p>{t(keyword ? 'client.workspaceSettings.noMatchingComputers'
        : 'client.chat.openRemoteAiOnYourComputerAndSignInWith')}</p>}
      {directory.refresh?.error && <p role="alert">{remoteErrorText(directory.refresh.error)}</p>}
      <div onKeyDown={event => {
        if (!['Escape', 'Tab', 'ArrowDown', 'ArrowUp'].includes(event.key)) event.stopPropagation();
      }}>
        <ComputerSearchBar query={query} onQueryChange={setQuery} refresh={directory.refresh}
          searchLabel={t('client.workspaceSettings.searchComputers')}
          refreshLabel={t('client.workspaceSettings.refreshComputerList')} />
      </div>
    </> }];
  };
  return { items, reset: () => setQuery('') };
}

export function SshComputerMenu({ directory, choose, children, disabled }: {
  directory: SshHostDirectory; choose: ChooseComputer; children: ReactElement; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const computers = useSshComputerMenu(directory);
  return <Dropdown trigger={['click']} autoFocus destroyOnHidden disabled={disabled} open={open && !disabled}
    align={{ points: ['tl', 'tr'], offset: [4, 0], overflow: { adjustX: true, adjustY: true } }}
    onOpenChange={next => { if (next) computers.reset(); setOpen(next); }}
    menu={{ 'aria-label': t('client.settings.chooseAComputer'), className: 'sshw-computer-menu',
      items: open ? computers.items('ssh', choose) : [] }}>
    {cloneElement(children, { 'aria-haspopup': 'menu', 'aria-expanded': open && !disabled,
      onContextMenuCapture: () => setOpen(false) })}
  </Dropdown>;
}
