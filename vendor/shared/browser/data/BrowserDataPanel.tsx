import { useState } from 'react';
import { Button, Empty, Input, theme } from 'antd';
import { Clock, Globe, Search, X } from 'lucide-react';
import type { Language } from '@remoteai/i18n';
import { marketText } from '../../provider-market/i18n';
import { useBrowserData } from './context';
import { historyGroups, type Visit } from './model';
import { dataStatusKeys } from './presentation';
import { ClearBrowserData } from './ClearBrowserData';
import type { DataControls } from './clear';
import { BrowserDataView, browserDataTabContainer } from './BrowserDataView';
import './browserData.css';

export function BrowserHistory({ language, close, visit, controls }: {
  language: Language; close?: () => void; visit: (url: string) => void; controls: DataControls;
}) {
  const t = marketText(language), data = useBrowserData(), { token } = theme.useToken();
  const [query, setQuery] = useState(''), [clearing, setClearing] = useState(false), [error, setError] = useState(false);
  const groups = historyGroups(data.entries.filter((entry): entry is Visit => entry.kind === 'visit'), query);
  return <BrowserDataView title={t('market.browserHistory')} close={close}>
    <div className="browser-data-tools"><Input prefix={<Search size="1em" />} value={query}
      allowClear aria-label={t('market.browserHistorySearch')} placeholder={t('market.browserHistorySearch')}
      onChange={event => setQuery(event.target.value)} />
      <Button onClick={() => setClearing(true)}>{t('market.browserDataClear')}</Button></div>
    <p role="status" style={{ color: token.colorTextSecondary }}>{t(dataStatusKeys[data.status])}</p>
    {error && <p role="alert">{t('market.browserDataStorage')}</p>}
    <div className="browser-data-scroll">
      {!groups.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('market.browserHistoryEmpty')} />}
      {groups.map(([day, entries]) => <section key={day}>
        <h3 className="browser-data-day"><Clock size="1em" />
          {new Date(day).toLocaleDateString(language, { dateStyle: 'full' })}</h3>
        {entries.map(entry => <div className="browser-data-row" key={entry.id}>
          <button className="browser-data-visit" type="button" onClick={() => { visit(entry.url); close?.(); }}>
            <Globe size="1.5em" style={{ color: token.colorPrimary }} />
            <span><strong>{entry.title || new URL(entry.url).hostname}</strong>
              <small style={{ color: token.colorTextSecondary }}>{new URL(entry.url).host}</small></span>
          </button>
          <Button type="text" icon={<X size="1.15em" />} aria-label={t('market.browserHistoryRemove')}
            onClick={() => { try { data.store.remove([entry.id]); setError(false); } catch { setError(true); } }} />
        </div>)}
      </section>)}
    </div>
    {clearing && <ClearBrowserData language={language} controls={controls} close={() => setClearing(false)}
      getContainer={close ? undefined : browserDataTabContainer} />}
  </BrowserDataView>;
}
