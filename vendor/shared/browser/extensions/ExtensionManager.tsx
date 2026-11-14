import { useState, type CSSProperties } from 'react';
import { Alert, Button, Empty, Input, Modal, Tag, theme } from 'antd';
import { ArrowLeft, Chrome, RefreshCw, Search } from 'lucide-react';
import { ProjectExplorer } from '../../project-explorer/ProjectExplorer';
import { t as uiText, getLocale } from '../../localization/browserClient';
import type { MarketText } from '../../provider-market/i18n';
import type { useExtensions } from './useExtensions';
import { ExtensionCard, ExtensionIcon, ExtensionPermissions } from './ExtensionCard';
import { ExtensionDropZone } from './ExtensionDropZone';
import assistantIcon from './assistant.png';
export { ExtensionIcon } from './ExtensionCard';

type Extensions = ReturnType<typeof useExtensions>;
export function ExtensionManager({ extensions, t, close }: { extensions: Extensions; t: MarketText; close: () => void }) {
  const [chrome, setChrome] = useState(false), [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const { token } = theme.useToken();
  const matches = (name: string) => name.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim());
  const entries = extensions.entries.filter(entry => matches(entry.name));
  const candidates = extensions.candidates.filter(entry => matches(entry.name));
  const styles = { '--extension-border': token.colorBorderSecondary, '--extension-surface': token.colorFillQuaternary,
    '--extension-accent': token.colorPrimary, '--extension-accent-bg': token.colorPrimaryBg,
    '--extension-muted': token.colorTextSecondary, '--extension-error': token.colorError,
    '--extension-radius': `${token.borderRadiusLG}px` } as CSSProperties;
  return <>
    <Modal open title={t('market.extensionsManage')} onCancel={close} footer={null} width={780}
      className="browser-extension-manager" destroyOnClose>
      <div className="browser-extension-management" style={styles}>
        <p className="browser-extension-subtitle">
          {t(extensions.native ? 'market.extensionsLocalNotice' : 'market.extensionsRemoteNotice')}</p>
        {extensions.error && <Alert type="error" showIcon message={t(extensions.error)} />}
        {extensions.supported === false && <Alert type="info" showIcon message={t('market.extensionsUnsupported')} />}
        <div className="browser-extension-manager-actions">
          {chrome ? <Button type="text" icon={<ArrowLeft size="1em" />} onClick={() => { setChrome(false); setQuery(''); }}>
            {t('market.extensionsBack')}</Button> : <Button icon={<Chrome size="1.15em" />}
            disabled={!extensions.supported || extensions.busy} onClick={() => {
              setChrome(true); setQuery(''); void extensions.request({ action: 'discover' });
            }}>{t('market.extensionsImport')}</Button>}
          <Button type="text" aria-label={t('market.extensionsRefresh')} disabled={extensions.busy}
            icon={<RefreshCw size="1.2em" />} onClick={() => void extensions.request({ action: chrome ? 'discover' : 'list' })} />
        </div>
        {!chrome && <>
          <ExtensionDropZone extensions={extensions} t={t} browse={() => setPicking(true)} />
          <div className="browser-extension-assistant">
            <span className="browser-extension-avatar"><img className="browser-extension-icon" src={assistantIcon} alt="" /></span>
            <div className="browser-extension-details"><div className="browser-extension-card-title">
              <strong>{t('market.extensionsAssistant')}</strong><Tag bordered={false} color="success">
                {t('market.extensionsBuiltin')}</Tag></div><p>{t('market.extensionsAssistantInfo')}</p></div>
          </div>
        </>}
        {chrome && <p className="browser-extension-subtitle">{t('market.extensionsChromeHelp')}</p>}
        <div className="browser-extension-list-heading"><strong>
          {t(chrome ? 'market.extensionsChromeAvailable' : 'market.extensionsInstalled')}</strong>
          <Input allowClear prefix={<Search size="1em" />} value={query}
            aria-label={t('market.extensionsSearch')} placeholder={t('market.extensionsSearch')}
            onChange={event => setQuery(event.target.value)} />
        </div>
        <div className="browser-extension-cards" aria-busy={extensions.busy}>
          {!chrome && entries.map(entry => <ExtensionCard key={entry.id} entry={entry} extensions={extensions} t={t} />)}
          {chrome && candidates.map(entry => <div className="browser-extension-card" key={entry.path}>
            <span className="browser-extension-avatar"><ExtensionIcon icon={entry.icon} /></span>
            <div className="browser-extension-details"><strong>{entry.name}</strong>
              <div className="browser-extension-source">{entry.profile} · {entry.version}</div>
              <ExtensionPermissions permissions={entry.permissions} t={t} /></div>
            <Button aria-label={t('market.extensionsInstall')} disabled={extensions.busy} onClick={() => {
              void extensions.request({ action: 'install', path: entry.path }).then(ok => {
                if (ok) { setChrome(false); setQuery(''); }
              });
            }}>{t('market.extensionsInstall')}</Button>
          </div>)}
          {!extensions.busy && !(chrome ? candidates : entries).length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t(chrome ? 'market.extensionsEmptyChrome' : 'market.extensionsEmptyInstalled')} />}
        </div>
        <p className="browser-extension-note">{t('market.extensionsCompatibility')}</p>
      </div>
    </Modal>
    {picking && extensions.browseFiles && <ProjectExplorer mode="selectPath" title={t('market.extensionsBrowseTitle')}
      load={extensions.browseFiles} t={uiText} locale={getLocale()} close={() => setPicking(false)}
      chooseLabel={t('market.extensionsInstall')} acceptsFile={name => /\.(zip|crx)$/i.test(name) || name === 'manifest.json'}
      choosePath={path => {
        setPicking(false);
        void extensions.request({ action: 'install', path });
      }} />}
  </>;
}
