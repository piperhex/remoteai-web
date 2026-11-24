import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Empty, theme } from 'antd';
import { ChevronRight, KeyRound, UserRound, X } from 'lucide-react';
import type { Language } from '@remoteai/i18n';
import { marketText, type MarketText } from '../../provider-market/i18n';
import { useBrowserData } from './context';
import { matchingPasswords, type PasswordFocus } from './passwordFocus';
import type { SavedLogin } from './vault';
import type { Login } from './model';
import { VaultUnlock } from './PasswordManager';
import { useBrowserOverlay } from '../overlays/BrowserOverlayProvider';
import { listen } from '@tauri-apps/api/event';
import { usePasswordPopupPlacement } from './usePasswordPopupPlacement';
import './passwordSuggestions.css';

export function PasswordSuggestions({ language, tabId, focus, fill, close }: {
  language: Language; tabId: string; focus: PasswordFocus;
  fill: (login: Login, focusId?: string) => Promise<void>; close: () => void;
}) {
  const t = marketText(language), { token } = theme.useToken(), { passwords } = useBrowserData();
  const overlay = useBrowserOverlay();
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const container = usePasswordPopupPlacement(tabId, focus, overlay);
  const entries = matchingPasswords(passwords.entries, focus);
  const choose = async (entry: Login) => {
    if (busy) return;
    setBusy(true); setError(false);
    try { await fill(entry, focus.id); close(); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!overlay) container.current?.querySelector<HTMLElement>('button, input')?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', escape);
    overlay?.ownerDocument.addEventListener('keydown', escape);
    window.addEventListener('browser-popup-dismiss', close);
    return () => {
      document.removeEventListener('keydown', escape); overlay?.ownerDocument.removeEventListener('keydown', escape);
      window.removeEventListener('browser-popup-dismiss', close);
    };
  }, [close, overlay, container]);
  useEffect(() => {
    if (!overlay) return;
    const listener = listen(`browser-overlay-focus-${tabId}`, () => {
      container.current?.querySelector<HTMLElement>('[data-browser-password-entry]')?.focus();
    });
    void listener.catch(error => console.debug('Password suggestion keyboard unavailable', error));
    return () => { void listener.then(stop => stop()).catch(() => {}); };
  }, [overlay, tabId, container]);
  return createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 1800,
    pointerEvents: overlay ? 'none' : undefined }} onPointerDown={close}>
    <div ref={container} className="password-suggestions" data-browser-popup role="dialog"
      aria-label={t('market.browserPasswordChoose')}
      onPointerDown={event => event.stopPropagation()} style={{ background: token.colorBgElevated,
        color: token.colorText, borderColor: token.colorBorderSecondary, fontSize: token.fontSize,
        boxShadow: token.boxShadowSecondary }}>
      <div>
        <SuggestionHeading t={t} origin={focus.origin} close={close} />
        {passwords.unlocked
          ? <AccountList entries={entries} t={t} busy={busy} choose={choose} />
          : <div className="password-suggestions-unlock"><VaultUnlock t={t} /></div>}
        {error && <p role="alert" style={{ color: token.colorError }}>{t('market.browserPasswordFillFailed')}</p>}
      </div>
    </div>
  </div>, overlay ?? document.body);
}

function SuggestionHeading({ t, origin, close }: { t: MarketText; origin: string; close: () => void }) {
  const { token } = theme.useToken();
  return <div className="password-suggestions-heading" style={{ borderColor: token.colorSplit }}>
    <span className="password-suggestions-key" aria-hidden><KeyRound size="1.3em" /></span>
    <div className="password-suggestions-label">
      <strong style={{ fontSize: token.fontSizeHeading5 }}>{t('market.browserPasswordChoose')}</strong>
      <span dir="ltr" style={{ color: token.colorTextSecondary }}>{origin}</span>
    </div>
    <Button type="text" size="small" aria-label={t('market.close')}
      icon={<X size="1.1em" />} onClick={close} />
  </div>;
}

function AccountList({ entries, t, busy, choose }: {
  entries: SavedLogin[]; t: MarketText; busy: boolean; choose: (entry: Login) => Promise<void>;
}) {
  const { token } = theme.useToken();
  return <div className="password-suggestions-list">
    {!entries.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={t('market.browserPasswordEmpty')} />}
    {entries.map(entry => <button type="button" data-browser-password-entry key={entry.id} disabled={busy}
      className="password-suggestions-entry" onClick={() => void choose(entry)}>
      <span className="password-suggestions-avatar" aria-hidden
        style={{ color: token.colorTextSecondary, background: token.colorFillTertiary }}>
        <UserRound size="1.2em" />
      </span>
      <span className="password-suggestions-label">
        <strong dir="auto">{entry.username || t('market.browserPasswordUsername')}</strong>
        <span className="password-suggestions-mask" aria-hidden style={{ color: token.colorTextTertiary }}>
          ••••••••
        </span>
      </span>
      <ChevronRight aria-hidden size="1.1em" style={{ color: token.colorTextTertiary }} />
    </button>)}
  </div>;
}
