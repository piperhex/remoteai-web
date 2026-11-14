import { useState } from 'react';
import { Button, Popover, Space, Switch, Tag } from 'antd';
import { ExternalLink, Info, Pin, PinOff, Puzzle, Trash2 } from 'lucide-react';
import type { MarketText } from '../../provider-market/i18n';
import type { BrowserExtension } from './model';
import type { useExtensions } from './useExtensions';

export function ExtensionIcon({ icon }: { icon?: string }) {
  const [failed, setFailed] = useState<string>();
  return icon && icon !== failed && /^data:image\/(png|jpeg|gif|webp|x-icon|bmp);base64,/.test(icon)
    ? <img className="browser-extension-icon" src={icon} alt="" onError={() => setFailed(icon)} />
    : <Puzzle size="1.5em" />;
}

export function ExtensionPermissions({ permissions, t }: { permissions?: string[]; t: MarketText }) {
  return <Popover trigger="click" title={t('market.extensionsPermissions')} placement="bottom"
    styles={{ root: { maxWidth: 400 }, body: { maxWidth: 400, overflowWrap: 'anywhere' } }}
    content={permissions?.length ? permissions.join(', ') : t('market.extensionsNone')}>
    <Button type="text" size="small" icon={<Info size="1em" />}>{t('market.extensionsPermissions')}</Button>
  </Popover>;
}

export function ExtensionCard({ entry, extensions, t }: {
  entry: BrowserExtension; extensions: ReturnType<typeof useExtensions>; t: MarketText;
}) {
  return <div className="browser-extension-card" data-disabled={!entry.enabled || undefined}>
    <span className="browser-extension-avatar"><ExtensionIcon icon={entry.icon} /></span>
    <div className="browser-extension-details">
      <div className="browser-extension-card-title"><strong>{entry.name}</strong>
        <span className="browser-extension-version">{entry.version}</span>
        <Tag bordered={false} color={entry.enabled ? 'success' : 'default'}>
          {t(entry.enabled ? 'market.extensionsEnabled' : 'market.extensionsDisabled')}</Tag></div>
      <Space size={4} wrap className="browser-extension-card-actions">
        {entry.popup && <Button type="text" size="small" disabled={extensions.busy || !entry.enabled}
          icon={<ExternalLink size="1em" />} onClick={() => void extensions.request({ action: 'open', id: entry.id })}>
          {t(extensions.native ? 'market.extensionsOpen' : 'market.extensionsRemoteOpen')}</Button>}
        <ExtensionPermissions permissions={entry.permissions} t={t} />
      </Space>
    </div>
    <div className="browser-extension-controls">
      <Switch checked={entry.enabled} disabled={extensions.busy}
        aria-label={t(entry.enabled ? 'market.extensionsDisable' : 'market.extensionsEnable') + ': ' + entry.name}
        onChange={enabled => void extensions.request({ action: 'enable', id: entry.id, enabled })} />
      <Button type="text" disabled={extensions.busy} aria-pressed={entry.pinned}
        title={t(entry.pinned ? 'market.extensionsUnpin' : 'market.extensionsPin')}
        aria-label={t(entry.pinned ? 'market.extensionsUnpin' : 'market.extensionsPin') + ': ' + entry.name}
        icon={entry.pinned ? <Pin size="1.2em" /> : <PinOff size="1.2em" />}
        onClick={() => void extensions.request({ action: 'pin', id: entry.id, pinned: !entry.pinned })} />
      <Button type="text" danger disabled={extensions.busy} title={t('market.extensionsRemove')}
        aria-label={t('market.extensionsRemove') + ': ' + entry.name} icon={<Trash2 size="1.2em" />}
        onClick={() => void extensions.request({ action: 'remove', id: entry.id })} />
    </div>
  </div>;
}
