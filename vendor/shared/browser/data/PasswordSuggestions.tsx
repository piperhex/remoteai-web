import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Empty, theme } from 'antd';
import { KeyRound, X } from 'lucide-react';
import type { Language } from '@remoteai/i18n';
import { marketText } from '../../provider-market/i18n';
import { useBrowserData } from './context';
import { matchingPasswords, type PasswordFocus } from './passwordFocus';
import type { Login } from './model';
import { VaultUnlock } from './PasswordManager';
import { useBrowserOverlay } from '../overlays/BrowserOverlayProvider';
import { listen } from '@tauri-apps/api/event';

export function PasswordSuggestions({ language, tabId, focus, fill, close }: {
  language: Language; tabId: string; focus: PasswordFocus;
  fill: (login: Login, focusId?: string) => Promise<void>; close: () => void;
}) {
  const t = marketText(language), { token } = theme.useToken(), { passwords } = useBrowserData();
  const overlay = useBrowserOverlay();
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const entries = matchingPasswords(passwords.entries, focus);
  const surface = document.getElementById(`page-${tabId}`)?.querySelector('.pm-browser-surface')?.getBoundingClientRect();
  const scale = surface ? surface.width / focus.viewport.width : 1;
  const width = Math.min(360, innerWidth - 24);
  const x = (surface?.x ?? 12) + focus.bounds.x * scale;
  const y = (surface?.y ?? 0) + (focus.bounds.y + focus.bounds.height) * scale + 6;
  const top = Math.max(12, Math.min(y, innerHeight - 280));
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
  }, [close, overlay]);
  useEffect(() => {
    if (!overlay) return;
    const listener = listen(`browser-overlay-focus-${tabId}`, () => {
      container.current?.querySelector<HTMLElement>('[data-browser-password-entry]')?.focus();
    });
    void listener.catch(error => console.debug('Password suggestion keyboard unavailable', error));
    return () => { void listener.then(stop => stop()).catch(() => {}); };
  }, [overlay, tabId]);
  return createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 1800,
    pointerEvents: overlay ? 'none' : undefined }} onPointerDown={close}>
    <div ref={container} data-browser-popup role="dialog" aria-label={t('market.browserPasswordChoose')} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); close(); }
    }}
      onPointerDown={event => event.stopPropagation()} style={{ position: 'absolute', width, maxWidth: 400,
        pointerEvents: 'auto',
        left: Math.max(12, Math.min(x, innerWidth - width - 12)), top, maxHeight: innerHeight - top - 12,
        overflowY: 'auto',
        padding: token.paddingSM, borderRadius: token.borderRadiusLG, background: token.colorBgElevated,
        color: token.colorText, boxShadow: token.boxShadowSecondary, fontSize: token.fontSize }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
        <KeyRound size="1.2em" /><strong style={{ flex: 1 }}>{t('market.browserPasswordChoose')}</strong>
        <Button type="text" size="small" aria-label={t('market.close')} icon={<X size="1em" />} onClick={close} />
      </div>
      <div style={{ color: token.colorTextSecondary, overflowWrap: 'anywhere', marginBlock: token.marginXS }}>
        {focus.origin}</div>
      {!passwords.unlocked ? <VaultUnlock t={t} /> : <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {!entries.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('market.browserPasswordEmpty')} />}
        {entries.map(entry => <Button block data-browser-password-entry key={entry.id} disabled={busy} style={{ height: 'auto',
          textAlign: 'left', whiteSpace: 'normal', marginBlock: token.marginXXS }} onClick={() => {
          if (busy) return;
          setBusy(true); setError(false);
          void fill(entry, focus.id).then(close).catch(() => setError(true)).finally(() => setBusy(false));
        }}><span style={{ display: 'block', width: '100%', overflowWrap: 'anywhere' }}>
          {entry.username || t('market.browserPasswordUsername')}<br /><span aria-hidden>••••••••</span>
        </span></Button>)}
      </div>}
      {error && <p role="alert" style={{ color: token.colorError }}>{t('market.browserPasswordFillFailed')}</p>}
    </div>
  </div>, overlay ?? document.body);
}
