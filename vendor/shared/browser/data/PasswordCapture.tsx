import { useEffect, useState } from 'react';
import { Modal } from 'antd';
import type { MarketText } from '../../provider-market/i18n';
import type { Login } from './model';
import { useBrowserData } from './context';
import { VaultUnlock } from './PasswordManager';

export function PasswordCapture({ login, t, close }: { login: Login; t: MarketText; close: () => void }) {
  const { passwords, vault } = useBrowserData(), [error, setError] = useState(false);
  useEffect(() => { const timer = setTimeout(close, 120000); return () => clearTimeout(timer); }, [close]);
  // Mount on the host document when the prompt opens from a native browser event.
  return <Modal open getContainer={() => document.body} title={t('market.browserPasswordSavePrompt')}
    width={400} zIndex={1950} onCancel={close}
    okText={t('market.save')} cancelText={t('market.cancel')} okButtonProps={{ disabled: !passwords.unlocked }}
    onOk={() => { try { vault.save(login); close(); } catch { setError(true); } }}>
    <p><strong>{login.origin}</strong><br />{login.username}</p>
    <p>{t('market.browserPasswordSaveHint')}</p>
    {!passwords.unlocked && <VaultUnlock t={t} />}
    {error && <p role="alert">{t('market.browserDataStorage')}</p>}
  </Modal>;
}
