import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Home, MoreVertical, Plus, X } from 'lucide-react';
import { Dropdown } from 'antd';
import type { BrowserTab } from '../provider-market/browserState';
import type { MarketText } from '../provider-market/i18n';
import { browserInput } from './addressInput';
import { useBrowserAddressInput } from './useBrowserAddressInput';
import type { SearchEngine } from './searchEngine';

export function MobileBrowserToolbar({ tab, t, engine, navigate, home, count, newTab, manage, settings }: {
  tab?: BrowserTab; t: MarketText; engine: SearchEngine; navigate: (url: string) => void;
  home: () => void; count: number; newTab: () => void; manage: () => void;
  settings: ReactNode;
}) {
  const [address, setAddress] = useState(tab?.url ?? '');
  const addressInput = useBrowserAddressInput(address);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setAddress(tab?.url ?? ''); setInvalid(false); }, [tab?.id, tab?.url]);
  return <div className="pm-browser-toolbar browser-mobile-toolbar">
    <button aria-label={t('market.browserHome')} onClick={home}><Home size={20} /></button>
    <form onSubmit={event => {
      event.preventDefault();
      const url = browserInput(address, engine);
      setInvalid(!url);
      if (url) { navigate(url.href); addressInput.ref.current?.blur(); }
    }}>
      <input {...addressInput} dir="ltr" aria-label={t('market.browserAddress')} aria-invalid={invalid}
        placeholder={t('market.browserSearchOrAddress')}
        value={address} onChange={event => { setAddress(event.target.value); setInvalid(false); }}
        spellCheck={false} autoComplete="off" enterKeyHint="go" />
    </form>
    <button aria-label={t('market.browserNewTab')} onClick={newTab}><Plus size={23} /></button>
    <button aria-label={t('market.browserManageTabs', { count })} onClick={manage}>
      <span className="browser-tab-count">{count}</span></button>
    {settings}
    {invalid && <span className="pm-browser-address-error" role="alert">{t('market.browserInvalidUrl')}</span>}
  </div>;
}

export function MobileTabManagerToolbar({ t, count, query, setQuery, close, add, closeAll }: {
  t: MarketText; count: number; query: string; setQuery: (value: string) => void; close: () => void; add: () => void;
  closeAll: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="browser-tab-manager-toolbar">
    <div><button aria-label={t('market.browserReturnToPage')} onClick={close}><ArrowLeft size={22} /></button>
      <strong>{t('market.browserTabs')} ({count})</strong>
      <button aria-label={t('market.browserNewTab')} onClick={add}><Plus size={24} /></button>
      <Dropdown trigger={['click']} placement="bottomRight" open={menuOpen} onOpenChange={setMenuOpen} autoFocus
        overlayClassName="browser-tab-manager-menu" menu={{ 'aria-label': t('market.moreActions'), items: [
          { key: 'closeAll', icon: <X size="1.1em" />, label: t('market.browserCloseAllTabs'),
            onClick: () => { setMenuOpen(false); closeAll(); } },
        ] }}>
        <button aria-label={t('market.moreActions')} aria-haspopup="menu" aria-expanded={menuOpen}>
          <MoreVertical size={22} /></button>
      </Dropdown></div>
    <input aria-label={t('market.browserSearchTabs')} placeholder={t('market.browserSearchTabs')}
      value={query} onChange={event => setQuery(event.target.value)} />
  </div>;
}
