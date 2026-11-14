import { useEffect, useState } from 'react';
import { Button, Empty, Input, Modal, Space } from 'antd';
import { KeyRound, Lock, Plus, Search } from 'lucide-react';
import type { Language } from '@remoteai/i18n';
import { marketText, type MarketText } from '../../provider-market/i18n';
import { useBrowserData } from './context';
import { loginOrigin, type Login } from './model';
import type { SavedLogin } from './vault';
import { dataStatusKeys } from './presentation';
import './browserData.css';

export function VaultUnlock({ t }: { t: MarketText }) {
  const { vault, hydrated } = useBrowserData(), creating = !vault.header();
  const [passphrase, setPassphrase] = useState(''), [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const valid = !creating || passphrase.length >= 12 && passphrase === confirm;
  const unlock = async () => {
    if (busy || !valid) return;
    setBusy(true); setError(false);
    try { await vault.unlock(passphrase); setPassphrase(''); setConfirm(''); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  return <form onSubmit={event => { event.preventDefault(); void unlock(); }}>
    <p>{t(creating ? 'market.browserVaultHint' : 'market.browserVaultUnlockHint')}</p>
    <div className="browser-password-fields">
      <label>{t('market.browserVaultPassphrase')}<Input.Password value={passphrase}
        autoComplete={creating ? 'new-password' : 'current-password'} maxLength={1024}
        onChange={event => setPassphrase(event.target.value)} /></label>
      {creating && <label>{t('market.browserVaultConfirm')}<Input.Password value={confirm} autoComplete="new-password"
        maxLength={1024} onChange={event => setConfirm(event.target.value)} /></label>}
    </div>
    {creating && !hydrated && <p>{t('market.browserVaultSyncRequired')}</p>}
    {error && <p role="alert">{t('market.browserVaultFailed')}</p>}
    <Button htmlType="submit" type="primary" loading={busy} disabled={!valid || !passphrase || creating && !hydrated}>
      {t(creating ? 'market.browserVaultCreate' : 'market.browserVaultUnlock')}</Button>
  </form>;
}

export function PasswordManager({ language, close, currentUrl, fill, candidate }: {
  language: Language; close: () => void; currentUrl: string;
  fill?: (login: Login) => Promise<void>; candidate?: Login;
}) {
  const t = marketText(language), { vault, passwords, status } = useBrowserData();
  const [query, setQuery] = useState(''), [editing, setEditing] = useState<Login | SavedLogin | null>(candidate ?? null);
  const [removing, setRemoving] = useState<SavedLogin>(), [error, setError] = useState(false);
  useEffect(() => { if (!passwords.unlocked) { setEditing(null); setRemoving(undefined); } }, [passwords.unlocked]);
  const shown = passwords.entries.filter(entry => `${entry.origin} ${entry.username}`
    .toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <Modal open title={t('market.browserPasswords')} width={640} zIndex={1800} onCancel={close}
    footer={null} className="browser-data-modal browser-chrome">
    <p role="status">{t(dataStatusKeys[status])}</p>
    {!passwords.unlocked ? <VaultUnlock t={t} /> : <>
      <div className="browser-data-tools"><Input prefix={<Search size="1em" />} value={query}
        placeholder={t('market.browserPasswordSearch')} aria-label={t('market.browserPasswordSearch')}
        onChange={event => setQuery(event.target.value)} />
        <Button icon={<Plus size="1em" />} onClick={() => setEditing({ origin: loginOrigin(currentUrl) ?? '',
          username: '', password: '' })}>{t('market.browserPasswordAdd')}</Button>
        <Button icon={<Lock size="1em" />} aria-label={t('market.browserVaultLock')}
          onClick={() => { void vault.lock().catch(() => setError(true)); }} /></div>
      {!fill && <p>{t('market.browserPasswordWebHint')}</p>}
      {status === 'conflict' && <VaultConflict t={t} />}
      {passwords.error && <p role="alert">{t('market.browserVaultCorrupt')}</p>}
      {error && <p role="alert">{t('market.browserPasswordFillFailed')}</p>}
      <div className="browser-data-scroll">
        {!shown.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('market.browserPasswordEmpty')} />}
        {shown.map(entry => <div className="browser-password-row" key={entry.id}>
          <KeyRound size="1.4em" /><span style={{ flex: 1 }}><strong>{entry.origin}</strong><small>{entry.username}</small></span>
          <Space wrap>
            {fill && entry.origin === loginOrigin(currentUrl) && <Button onClick={() => {
              void fill(entry).then(close).catch(() => setError(true));
            }}>{t('market.browserPasswordFill')}</Button>}
            <Button onClick={() => setEditing(entry)}>{t('market.browserPasswordEdit')}</Button>
            <Button danger onClick={() => setRemoving(entry)}>{t('market.bookmarkDelete')}</Button>
          </Space>
        </div>)}
      </div>
      {editing && <PasswordEditor t={t} login={editing} close={() => setEditing(null)} />}
    </>}
    <Modal open={!!removing} title={t('market.browserPasswords')} zIndex={1900} width={400}
      okText={t('market.bookmarkDelete')} cancelText={t('market.cancel')} okButtonProps={{ danger: true }}
      onCancel={() => setRemoving(undefined)} onOk={() => {
        if (removing) { try { vault.remove([removing.id]); setRemoving(undefined); } catch { setError(true); } }
      }}>{t('market.browserPasswordDeleteConfirm')}</Modal>
  </Modal>;
}

function VaultConflict({ t }: { t: MarketText }) {
  const { vault } = useBrowserData(), [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  return <form onSubmit={event => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(false);
    void vault.mergeConflict(phrase).then(() => setPhrase('')).catch(() => setError(true)).finally(() => setBusy(false));
  }}>
    <label>{t('market.browserVaultPassphrase')}<Input.Password value={phrase} maxLength={1024}
      autoComplete="off" onChange={event => setPhrase(event.target.value)} /></label>
    <Button htmlType="submit" loading={busy} disabled={!phrase}>{t('market.save')}</Button>
    {error && <p role="alert">{t('market.browserVaultFailed')}</p>}
  </form>;
}

function PasswordEditor({ t, login, close }: { t: MarketText; login: Login | SavedLogin; close: () => void }) {
  const { vault } = useBrowserData(), [draft, setDraft] = useState<Login>(login), [error, setError] = useState(false);
  const update = (key: keyof Login, value: string) => setDraft(current => ({ ...current, [key]: value }));
  const save = () => {
    const origin = loginOrigin(draft.origin);
    if (!origin || !draft.password) { setError(true); return; }
    try { vault.save({ ...draft, origin }, 'id' in login ? login.id : undefined); close(); }
    catch { setError(true); }
  };
  return <Modal open title={t('id' in login ? 'market.browserPasswordEdit' : 'market.browserPasswordAdd')}
    zIndex={1900} width={480} onCancel={close} onOk={save} okText={t('market.save')} cancelText={t('market.cancel')}>
    <div className="browser-password-fields">
      <label>{t('market.browserPasswordOrigin')}<Input value={draft.origin} autoComplete="off" maxLength={2048}
        onChange={event => update('origin', event.target.value)} /></label>
      <label>{t('market.browserPasswordUsername')}<Input value={draft.username} autoComplete="off" maxLength={512}
        onChange={event => update('username', event.target.value)} /></label>
      <label>{t('market.browserPasswordValue')}<Input.Password value={draft.password} autoComplete="new-password"
        maxLength={4096} onChange={event => update('password', event.target.value)} /></label>
    </div>
    {error && <p role="alert">{t('market.browserPasswordInvalid')}</p>}
  </Modal>;
}
