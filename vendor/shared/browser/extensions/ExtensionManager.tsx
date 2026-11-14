import { useState } from 'react';
import { Alert, Button, Empty, Input, Modal, Space, Switch, Tag } from 'antd';
import { ArrowLeft, FolderOpen, Pin, PinOff, Puzzle, RefreshCw, Trash2 } from 'lucide-react';
import type { MarketText } from '../../provider-market/i18n';
import type { BrowserExtension } from './model';
import type { useExtensions } from './useExtensions';
import assistantIcon from './assistant.png';

type Extensions = ReturnType<typeof useExtensions>;
export function ExtensionIcon({ icon }: { icon?: string }) {
  const [failed, setFailed] = useState<string>();
  return icon && icon !== failed && /^data:image\/(png|jpeg|gif|webp|x-icon|bmp);base64,/.test(icon)
    ? <img className="browser-extension-icon" src={icon} alt="" onError={() => setFailed(icon)} />
    : <Puzzle size="1.5em" />;
}

function ExtensionDetails({ entry, extensions, t }: { entry: BrowserExtension; extensions: Extensions; t: MarketText }) {
  return <div className="browser-extension-card">
    <ExtensionIcon icon={entry.icon} /><div className="browser-extension-details">
      <strong>{entry.name}</strong> <span className="browser-extension-version">{entry.version}</span>
      <div className="browser-extension-permissions">{t('market.extensionsPermissions')}: {
        entry.permissions?.length ? entry.permissions.join(', ') : t('market.extensionsNone')}</div>
      <Space wrap>
        <Button size="small" disabled={extensions.busy} icon={entry.pinned ? <PinOff size="1em" /> : <Pin size="1em" />}
          onClick={() => void extensions.request({ action: 'pin', id: entry.id, pinned: !entry.pinned })}>
          {t(entry.pinned ? 'market.extensionsUnpin' : 'market.extensionsPin')}</Button>
        {entry.popup && <Button size="small" disabled={extensions.busy || !entry.enabled}
          onClick={() => void extensions.request({ action: 'open', id: entry.id })}>
          {t(extensions.native ? 'market.extensionsOpen' : 'market.extensionsRemoteOpen')}</Button>}
        <Button size="small" danger disabled={extensions.busy} icon={<Trash2 size="1em" />}
          onClick={() => void extensions.request({ action: 'remove', id: entry.id })}>{t('market.extensionsRemove')}</Button>
      </Space>
    </div><Switch checked={entry.enabled} disabled={extensions.busy}
      aria-label={t(entry.enabled ? 'market.extensionsDisable' : 'market.extensionsEnable') + ': ' + entry.name}
      onChange={enabled => void extensions.request({ action: 'enable', id: entry.id, enabled })} />
  </div>;
}

export function ExtensionManager({ extensions, t, close }: { extensions: Extensions; t: MarketText; close: () => void }) {
  const [view, setView] = useState<'installed' | 'chrome' | 'folder'>('installed');
  const [path, setPath] = useState('');
  const choose = async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === 'string') setPath(selected);
  };
  return <Modal open title={t('market.extensionsManage')} onCancel={close} footer={null} width={720}
    className="browser-extension-manager" destroyOnClose>
    <p>{t(extensions.native ? 'market.extensionsLocalNotice' : 'market.extensionsRemoteNotice')}</p>
    {extensions.error && <Alert type="error" showIcon message={t(extensions.error)} />}
    {extensions.supported === false && <Alert type="info" showIcon message={t('market.extensionsUnsupported')} />}
    <div className="browser-extension-manager-actions">
      {view !== 'installed' ? <Button icon={<ArrowLeft size="1em" />} onClick={() => setView('installed')}>
        {t('market.extensionsBack')}</Button> : <Space wrap>
        <Button disabled={!extensions.supported || extensions.busy} onClick={() => {
          setView('chrome'); void extensions.request({ action: 'discover' });
        }}>{t('market.extensionsImport')}</Button>
        <Button disabled={!extensions.supported || extensions.busy} onClick={() => setView('folder')}
          icon={<FolderOpen size="1em" />}>{t('market.extensionsLoad')}</Button>
      </Space>}
      <Button aria-label={t('market.extensionsRefresh')} disabled={extensions.busy} icon={<RefreshCw size="1em" />}
        onClick={() => void extensions.request({ action: view === 'chrome' ? 'discover' : 'list' })} />
    </div>
    {view === 'installed' && <>
      <div className="browser-extension-card"><img className="browser-extension-icon" src={assistantIcon} alt="" />
        <div className="browser-extension-details">
        <strong>{t('market.extensionsAssistant')}</strong> <Tag color="green">{t('market.extensionsBuiltin')}</Tag>
        <p>{t('market.extensionsAssistantInfo')}</p></div></div>
      {extensions.entries.map(entry => <ExtensionDetails key={entry.id} entry={entry} extensions={extensions} t={t} />)}
    </>}
    {view === 'chrome' && <><p>{t('market.extensionsChromeHelp')}</p>
      {!extensions.busy && !extensions.candidates.length && <Empty description={t('market.extensionsEmptyChrome')} />}
      {extensions.candidates.map(entry => <div className="browser-extension-card" key={entry.path}>
        <ExtensionIcon icon={entry.icon} /><div className="browser-extension-details"><strong>{entry.name}</strong>
          <div>{entry.profile} · {entry.version}</div>
          <div className="browser-extension-permissions">{t('market.extensionsPermissions')}: {
            entry.permissions.length ? entry.permissions.join(', ') : t('market.extensionsNone')}</div>
        </div><Button aria-label={t('market.extensionsInstall')} disabled={extensions.busy} onClick={() => {
          void extensions.request({ action: 'install', path: entry.path }).then(ok => { if (ok) setView('installed'); });
        }}>{t('market.extensionsInstall')}</Button></div>)}</>}
    {view === 'folder' && <div className="browser-extension-folder">
      <label htmlFor="browser-extension-folder">{t('market.extensionsFolder')}</label>
      <Input id="browser-extension-folder" value={path} onChange={event => setPath(event.target.value)} />
      <p>{t(extensions.native ? 'market.extensionsFolderHelp' : 'market.extensionsRemoteFolderHelp')}</p>
      <Space wrap>{extensions.native && <Button onClick={() => void choose().catch(() => {
        // Manual path entry remains available if the directory picker is unavailable.
      })}>{t('market.extensionsChoose')}</Button>}
      <Button type="primary" aria-label={t('market.extensionsInstall')}
        disabled={!path.trim() || extensions.busy} loading={extensions.busy}
        onClick={() => void extensions.request({ action: 'install', path: path.trim() })
          .then(ok => { if (ok) { setPath(''); setView('installed'); } })}>{t('market.extensionsInstall')}</Button></Space>
    </div>}
    <p className="browser-extension-note">{t('market.extensionsCompatibility')}</p>
  </Modal>;
}
