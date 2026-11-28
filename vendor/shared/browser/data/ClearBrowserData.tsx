import { useState } from 'react';
import { Button, Checkbox, Modal, Select, theme } from 'antd';
import { Clock, Cookie, Image, KeyRound, PanelsTopLeft } from 'lucide-react';
import type { Language } from '@remoteai/i18n';
import { marketText } from '../../provider-market/i18n';
import { useBrowserData } from './context';
import { rangeStart, timeRanges, type TimeRange } from './model';
import { categoryKeys, categoryHints, rangeKeys, type DataCategory } from './presentation';
import { clearBrowserData, type DataControls } from './clear';

const icons = { history: Clock, cookies: Cookie, cache: Image, tabs: PanelsTopLeft, passwords: KeyRound };
export function ClearBrowserData({ language, controls, close, getContainer }: {
  language: Language; controls: DataControls; close: () => void; getContainer?: () => HTMLElement;
}) {
  const t = marketText(language), { store, vault, entries, passwords } = useBrowserData();
  const { token } = theme.useToken();
  const [range, setRange] = useState<TimeRange>('hour');
  const [selected, setSelected] = useState<DataCategory[]>(controls.clearSiteData ? ['history', 'cookies', 'cache'] : ['history']);
  const [busy, setBusy] = useState(false), [result, setResult] = useState<'failed' | 'done'>();
  const [confirm, setConfirm] = useState(false);
  const since = rangeStart(range);
  const counts = { history: entries.filter(entry => entry.kind === 'visit' && entry.at >= since).length,
    passwords: entries.filter(entry => entry.kind === 'password' && entry.at >= since).length,
    tabs: controls.tabs.filter(tab => tab.at >= since).length };
  const remove = async () => {
    if (busy) return;
    setBusy(true); setResult(undefined);
    try { await clearBrowserData({ store, vault, controls, categories: selected, range }); setResult('done'); }
    catch { setResult('failed'); }
    finally { setBusy(false); setConfirm(false); }
  };
  return <Modal open title={t('market.browserDataClear')} width={580} zIndex={1850} getContainer={getContainer}
    onCancel={() => !busy && close()}
    className="browser-data-modal browser-chrome" footer={<Button danger type="primary" loading={busy}
      disabled={!selected.length} onClick={() => setConfirm(true)}>{t('market.browserDataDelete')}</Button>}>
    <label className="browser-data-range">{t('market.browserDataRange')}
      <Select value={range} onChange={setRange} disabled={busy} aria-label={t('market.browserDataRange')}
        getPopupContainer={getContainer}
        options={timeRanges.map(value => ({ value, label: t(rangeKeys[value]) }))} /></label>
    <div className="browser-data-scroll">
      {(Object.keys(categoryKeys) as DataCategory[]).map(category => {
        const Icon = icons[category];
        const disabled = busy || (category === 'cookies' || category === 'cache') && !controls.clearSiteData
          || category === 'passwords' && !passwords.unlocked;
        return <label key={category} className="browser-data-choice"
          style={{ background: token.colorFillQuaternary, opacity: disabled ? 0.6 : 1 }}>
          <Icon size="1.7em" />
          <span><strong>{t(categoryKeys[category])}</strong>
            {category in counts && <small>{t('market.browserDataCount', { count: counts[category as keyof typeof counts] })}</small>}
            {categoryHints[category] && <small style={{ color: token.colorTextSecondary }}>{t(categoryHints[category]!)}</small>}
            {category === 'passwords' && !passwords.unlocked && <small>{t('market.browserVaultUnlock')}</small>}
          </span>
          <Checkbox checked={selected.includes(category)} disabled={disabled} aria-label={t(categoryKeys[category])}
            onChange={event => setSelected(current => event.target.checked ? [...current, category]
              : current.filter(value => value !== category))} />
        </label>;
      })}
    </div>
    {!controls.clearSiteData && <p>{t('market.browserDataWebHint')}</p>}
    {result && <p role={result === 'failed' ? 'alert' : 'status'}>{t(result === 'failed'
      ? 'market.browserDataFailed' : 'market.browserDataDeleted')}</p>}
    <Modal open={confirm} title={t('market.browserDataClear')} zIndex={1900} width={400} getContainer={getContainer}
      onCancel={() => !busy && setConfirm(false)} onOk={() => void remove()} confirmLoading={busy}
      okText={t('market.browserDataDelete')} cancelText={t('market.cancel')} okButtonProps={{ danger: true }}>
      {t('market.browserDataConfirm')}
    </Modal>
  </Modal>;
}
