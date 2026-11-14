import { useContext, useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, Modal, Spin } from 'antd';
import { RefreshCw, Search } from 'lucide-react';
import type { MarketText } from '../../provider-market/i18n';
import type { useExtensions } from './useExtensions';
import { ExtensionIcon, ExtensionPermissions } from './ExtensionCard';
import { ExtensionMarketContext, listMarket, type MarketExtension } from './market';

export function ExtensionMarket({ extensions, t }: { extensions: ReturnType<typeof useExtensions>; t: MarketText }) {
  const base = useContext(ExtensionMarketContext);
  const [items, setItems] = useState<MarketExtension[]>([]), [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true), [error, setError] = useState(false);
  const [revision, setRevision] = useState(0), [selected, setSelected] = useState<MarketExtension>();
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let active = true;
    setItems([]); setSelected(undefined); setLoading(true); setError(false);
    void (async () => {
      try {
        if (!base) throw new Error('market.extensionsMarketFailed');
        const entries = await listMarket(base, controller.signal);
        if (active) setItems(entries);
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); clearTimeout(timeout); }
    })();
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [base, revision]);
  const visible = items.filter(item => `${item.name} ${item.description}`
    .toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const installed = (item: MarketExtension) => extensions.entries.some(entry =>
    entry.market?.id === item.id && entry.market.sha256 === item.sha256);
  return <div className="browser-extension-market">
    <p className="browser-extension-subtitle">{t('market.extensionsMarketHint')}</p>
    <div className="browser-extension-list-heading">
      <Input allowClear prefix={<Search size="1em" />} value={query} placeholder={t('market.extensionsSearch')}
        aria-label={t('market.extensionsSearch')} onChange={event => setQuery(event.target.value)} />
      <Button type="text" icon={<RefreshCw size="1.2em" />} aria-label={t('market.extensionsRefresh')}
        disabled={loading || extensions.busy} onClick={() => setRevision(value => value + 1)} />
    </div>
    {error && <Alert showIcon type="error" message={t('market.extensionsMarketFailed')} />}
    <Spin spinning={loading}><div className="browser-extension-cards" aria-busy={loading}>
      {visible.map(item => <div className="browser-extension-card" key={item.id}>
        <span className="browser-extension-avatar"><ExtensionIcon icon={item.icon} /></span>
        <div className="browser-extension-details">
          <div className="browser-extension-card-title"><strong>{item.name}</strong>
            <span className="browser-extension-version">{item.version}</span></div>
          <p className="browser-extension-subtitle">{item.description}</p>
          <ExtensionPermissions permissions={item.permissions} t={t} />
        </div>
        <Button type="primary" disabled={!extensions.supported || extensions.busy || installed(item)}
          onClick={() => setSelected(item)}>
          {t(installed(item) ? 'market.extensionsMarketInstalled' : 'market.extensionsInstall')}</Button>
      </div>)}
      {!loading && !error && !visible.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t('market.extensionsMarketEmpty')} />}
    </div></Spin>
    {selected && <Modal open title={t('market.extensionsReviewPermissions')} width={400}
      onCancel={() => setSelected(undefined)} okText={t('market.extensionsInstall')} cancelText={t('market.cancel')}
      onOk={() => { if (base) void extensions.installMarket(base, selected); setSelected(undefined); }}>
      <p>{t('market.extensionsConfirmInstall', { name: selected.name })}</p>
      <p style={{ overflowWrap: 'anywhere' }}>{selected.permissions.join(', ') || t('market.extensionsNone')}</p>
    </Modal>}
  </div>;
}
