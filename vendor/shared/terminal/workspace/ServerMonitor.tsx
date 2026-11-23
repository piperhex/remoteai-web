import { Activity, ArrowDown, ArrowUp, Clock3, Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { displayText as t } from '../../localization/messages';
import { useGuiLanguage } from '../../localization/useGuiLanguage';
import { formatRelayBytes } from '../../remote-chat/relayUsage';
import type { SshApi } from '../ssh';
import { formatServerSpeed } from './serverMetrics';
import { useServerMonitor } from './useServerMonitor';

function Meter({ value }: { value?: number }) {
  return <i className="sshm-meter" aria-hidden="true">
    <i style={{ width: `${value ?? 0}%` }} />
  </i>;
}

export function ServerMonitor({ api, id, enabled }: { api: SshApi; id: string; enabled: boolean }) {
  const locale = useGuiLanguage();
  const { reading, unavailable } = useServerMonitor(api, id, enabled);
  const { memory, disk, uptimeSeconds } = reading?.values ?? {};
  const bytes = (value: number) => formatRelayBytes(value, locale);
  const capacity = (pair?: [number, number] | null) => pair ? bytes(pair[0]) + ' / ' + bytes(pair[1]) : '—';
  const percent = (n?: number) => n === undefined ? '—' : `${n}%`;
  const diskUse = disk && disk[1] > 0 ? Math.round(100 * disk[0] / disk[1]) : undefined;
  const hours = uptimeSeconds == null ? undefined : uptimeSeconds / 3600;
  const uptime = hours === undefined ? '—' : new Intl.NumberFormat(locale, { style: 'unit',
    unit: hours >= 24 ? 'day' : hours >= 1 ? 'hour' : 'minute', maximumFractionDigits: 1,
  }).format(hours >= 24 ? hours / 24 : hours >= 1 ? hours : hours * 60);
  return <footer className="sshw-monitor" aria-label={t('client.ssh.serverSection')}>
    <div className="sshm-title"><Activity size={16} /><strong>{t('client.ssh.serverSection')}</strong></div>
    {reading ? <div className="sshm-values">
      <span><Cpu /><b>CPU</b><Meter value={reading.cpu} /><output>{percent(reading.cpu)}</output></span>
      <span><MemoryStick /><b>RAM</b><output>{capacity(memory)}</output></span>
      <span title={capacity(disk)}><HardDrive /><b>{reading.values.diskPath ?? '/'}</b><output>{percent(diskUse)}</output></span>
      <span title={t('client.remoteDesktop.network')}><ArrowDown aria-label={t('client.ssh.download')} />
        <output data-speed="download">{formatServerSpeed(reading.download, locale)}</output>
        <ArrowUp aria-label={t('client.ssh.upload')} />
        <output data-speed="upload">{formatServerSpeed(reading.upload, locale)}</output></span>
      <span title={t('client.chat.duration.8d6d31')}><Clock3 /><output>{uptime}</output></span>
    </div> : <div className="sshm-status">{t(unavailable ? 'client.conversationWorkspace.unavailable'
      : 'client.conversationWorkspace.loading')}</div>}
  </footer>;
}
