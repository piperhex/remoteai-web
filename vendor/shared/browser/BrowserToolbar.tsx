import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Maximize2, Minimize2, RotateCw, X } from 'lucide-react';
import type { BrowserAction, BrowserTab } from '../provider-market/browserState';
import type { MarketText } from '../provider-market/i18n';
import { browserInput } from './addressInput';
import type { SearchEngine } from './searchEngine';
import { BrowserWebsiteIcon } from './icons/BrowserWebsiteIcon';
import { BrowserAddressField } from './BrowserAddressField';

export function BrowserToolbar({ tab, loading, fullscreen, toggleFullscreen, navigate, action, t, actions, star, settings,
  searchEngine, active, overlayChanged }: {
  loading: boolean; active: boolean; overlayChanged: (open: boolean) => void;
  tab?: BrowserTab; fullscreen: boolean; toggleFullscreen: () => void;
  navigate: (url: string) => void; action: (action: BrowserAction) => void; t: MarketText; actions?: ReactNode;
  star?: ReactNode; settings?: ReactNode;
  searchEngine: SearchEngine;
}) {
  const toolbar = useRef<HTMLDivElement>(null);
  const blurAddress = () => toolbar.current?.querySelector('input')?.blur();
  const [address, setAddress] = useState(tab?.url ?? '');
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setAddress(tab?.url ?? ''); setInvalid(false); }, [tab?.id, tab?.url]);
  const submit = (value: string) => {
    if (tab?.url.startsWith('file:') && value.trim() === tab.url) {
      setInvalid(false); blurAddress(); action('reload'); return;
    }
    const url = browserInput(value, searchEngine);
    setInvalid(!url);
    if (url) { setAddress(url.href); blurAddress(); navigate(url.href); }
  };
  return <div ref={toolbar} className="pm-browser-toolbar">
    <button aria-label={t('market.browserBack')} title={t('market.browserBack')}
      disabled={!tab?.url} onClick={() => action('back')}><ArrowLeft size={17} /></button>
    <button aria-label={t('market.browserForward')} title={t('market.browserForward')}
      disabled={!tab?.url} onClick={() => action('forward')}><ArrowRight size={17} /></button>
    <button aria-label={t(loading ? 'market.cancel' : 'market.browserReload')}
      title={t(loading ? 'market.cancel' : 'market.browserReload')}
      disabled={!tab?.url} onClick={() => action(loading ? 'stop' : 'reload')}>
      {loading ? <X size={17} /> : <RotateCw size={17} />}</button>
    <form onSubmit={event => { event.preventDefault(); submit(address); }}>
      <BrowserWebsiteIcon url={tab?.url} size={15} />
      <BrowserAddressField address={address} context={JSON.stringify([tab?.id, tab?.url])} active={active}
        invalid={invalid} change={value => { setAddress(value); setInvalid(false); }}
        submit={submit} overlayChanged={overlayChanged} t={t} />
      {star}<button type="submit" aria-label={t('market.visitPage')}><ArrowRight size={16} /></button>
    </form>
    {actions}
    <button aria-label={t(fullscreen ? 'market.browserRestore' : 'market.browserFullscreen')}
      title={t(fullscreen ? 'market.browserRestore' : 'market.browserFullscreen')} onClick={toggleFullscreen}>
      {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
    {settings}
    {invalid && <span className="pm-browser-address-error" role="alert">{t('market.browserInvalidUrl')}</span>}
  </div>;
}
