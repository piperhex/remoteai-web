import { useState } from 'react';
import { Button, Dropdown } from 'antd';
import { Monitor, Plus } from 'lucide-react';
import { useThreadLongPress } from '../../chat/useThreadLongPress';
import { t } from '../../localization/browserClient';
import type { ChatComputer } from '../../remote-chat/devices';
import { ComputerIdentity } from '../../remote-chat/ComputerIdentity';

export function AddDesktopMenu({ devices, openDesktop }: {
  devices: ChatComputer[]; openDesktop: (device: ChatComputer) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = t('client.settings.chooseAComputer');
  const gesture = useThreadLongPress(() => setOpen(true));
  return <Dropdown open={open} onOpenChange={setOpen} trigger={['click']} placement="bottomLeft" autoFocus
    overlayClassName="rd-add-desktop-menu" menu={{ 'aria-label': label,
      items: devices.length ? devices.map(device => ({
        key: device.deviceId, icon: <Monitor size={15} />, disabled: !device.online,
        label: <span className="rd-add-desktop-label">
          <ComputerIdentity name={device.name} device={device} />
          {!device.online && <small>{t('client.chat.offline')}</small>}
        </span>,
        onClick: () => { setOpen(false); openDesktop(device); },
      })) : [{ key: 'empty', disabled: true, label: t('client.mobile.noDevicesAvailable') }],
    }}>
    <Button {...gesture} type="text" icon={<Plus size={18} />} aria-label={label} title={label}
      aria-haspopup="menu" aria-expanded={open} />
  </Dropdown>;
}
