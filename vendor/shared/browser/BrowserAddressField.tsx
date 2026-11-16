import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { History } from 'lucide-react';
import type { MarketText } from '../provider-market/i18n';
import { useBrowserAddressInput } from './useBrowserAddressInput';
import { useAddressSuggestions } from './useAddressSuggestions';
import './browserAddress.css';

export function BrowserAddressField({ address, context, active, invalid, change, submit, overlayChanged, t }: {
  address: string; context: string; active: boolean; invalid: boolean; change: (value: string) => void;
  submit: (value: string) => void; overlayChanged: (open: boolean) => void; t: MarketText;
}) {
  const input = useBrowserAddressInput(address), listId = useId();
  const selected = useRef<HTMLDivElement>(null);
  const choose = (url: string) => { input.ref.current?.blur(); submit(url); };
  const menu = useAddressSuggestions({ address, context, active, choose });
  // Native child WebViews must yield to the popup while retaining their page preview.
  useLayoutEffect(() => {
    overlayChanged(menu.open);
    return () => overlayChanged(false);
  }, [menu.open, overlayChanged]);
  useEffect(() => { selected.current?.scrollIntoView({ block: 'nearest' }); }, [menu.index]);

  return <>
    <input {...input} dir="ltr" role="combobox" aria-label={t('market.browserAddress')} aria-invalid={invalid}
      aria-autocomplete="list" aria-expanded={menu.open} aria-controls={menu.open ? listId : undefined}
      aria-activedescendant={menu.index >= 0 ? `${listId}-${menu.index}` : undefined}
      value={address} onChange={event => { change(event.target.value); menu.edit(); }} onFocus={menu.edit}
      onBlur={() => { input.onBlur(); menu.close(); }} onKeyDown={menu.onKeyDown}
      onCompositionStart={menu.onCompositionStart} onCompositionEnd={menu.onCompositionEnd}
      placeholder={t('market.browserSearchOrAddress')} spellCheck={false} autoComplete="off" />
    {menu.open && <div id={listId} role="listbox" aria-label={t('market.browserHistory')}
      className="browser-address-suggestions" onMouseDown={event => event.preventDefault()}>
      {menu.suggestions.map((entry, index) => <div key={entry.url} id={`${listId}-${index}`}
        ref={index === menu.index ? selected : undefined} role="option" aria-selected={index === menu.index}
        className="browser-address-suggestion" onClick={() => choose(entry.url)}>
        <History size="1.15em" aria-hidden="true" />
        <span className="browser-address-suggestion-text">
          <span className="browser-address-suggestion-title">{entry.title || entry.url}</span>
          <span className="browser-address-suggestion-url" dir="ltr">{entry.url}</span>
        </span>
      </div>)}
    </div>}
  </>;
}
