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

export function PasswordSuggestions({ language, tabId, focus, fill, close }: {
  language: Language; tabId: string; focus: PasswordFocus;
  fill: (login: Login, focusId?: string) => Promise<void>; close: () => void;
}) {
  const t = marketText(language), { token } = theme.useToken(), { passwords } = useBrowserData();
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
    container.current?.querySelector<HTMLElement>('button, input')?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [close]);
  return createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 1800 }} onPointerDown={close}>
    <div ref={container} role="dialog" aria-label={t('market.browserPasswordChoose')} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); close(); }
    }}
      onPointerDown={event => event.stopPropagation()} style={{ position: 'absolute', width, maxWidth: 400,
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
        {entries.map(entry => <Button block key={entry.id} disabled={busy} style={{ height: 'auto',
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
  </div>, document.body);
}
