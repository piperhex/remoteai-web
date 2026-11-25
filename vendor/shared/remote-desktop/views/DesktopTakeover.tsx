import { useEffect, useId, useRef } from 'react';
import { t } from '../../localization/browserClient';
import './takeover.css';

export function DesktopTakeover({ confirm, cancel, disabled, embedded }: {
  confirm: () => void; cancel: () => void; disabled: boolean; embedded?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const description = useId();
  useEffect(() => {
    const element = dialog.current;
    if (embedded) element?.show();
    else element?.showModal();
    return () => element?.close();
  }, [embedded]);
  const prompt = <dialog ref={dialog} className="rd-takeover" aria-labelledby={title} aria-describedby={description}
    onKeyDown={event => { if (embedded && event.key === 'Escape') cancel(); }}
    onCancel={event => { event.preventDefault(); cancel(); }}>
    <h2 id={title}>{t('client.remoteDesktop.takeoverTitle')}</h2>
    <p id={description}>{t('client.remoteDesktop.takeoverMessage')}</p>
    <div className="rd-takeover-actions">
      <button autoFocus onClick={cancel}>{t('client.remoteDesktop.takeoverCancel')}</button>
      <button className="rd-takeover-confirm" disabled={disabled} onClick={confirm}>
        {t('client.remoteDesktop.takeoverConfirm')}</button>
    </div>
  </dialog>;
  return embedded ? <div className="rd-takeover-overlay">{prompt}</div> : prompt;
}
