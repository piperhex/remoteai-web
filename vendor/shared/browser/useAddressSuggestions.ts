import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useBrowserData } from './data/context';
import { addressSuggestions } from './addressSuggestions';

export function useAddressSuggestions(options: {
  address: string; context: string; active: boolean; choose: (url: string) => void;
}) {
  const { entries } = useBrowserData();
  const [editing, setEditing] = useState(false), [composing, setComposing] = useState(false);
  const [selected, setSelected] = useState<string>();
  const suggestions = useMemo(() => addressSuggestions(entries, options.address), [entries, options.address]);
  const open = options.active && editing && !composing && suggestions.length > 0;
  const index = open ? suggestions.findIndex(entry => entry.url === selected) : -1;
  const close = () => { setEditing(false); setSelected(undefined); setComposing(false); };
  const edit = () => { setEditing(true); setSelected(undefined); };
  useEffect(() => { setEditing(false); setSelected(undefined); }, [options.context, options.active]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (composing || event.nativeEvent.isComposing || event.keyCode === 229) {
      if (event.key === 'Enter') event.preventDefault();
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); close(); return;
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length) {
      event.preventDefault(); setEditing(true);
      const next = event.key === 'ArrowDown' ? index + 1 : (index < 0 ? suggestions.length : index) - 1;
      setSelected(suggestions[(next + suggestions.length) % suggestions.length].url);
    }
    if (event.key === 'Enter' && index >= 0) {
      event.preventDefault(); options.choose(suggestions[index].url); close();
    }
  };
  return { suggestions, open, index, edit, close, onKeyDown,
    onCompositionStart: () => { setComposing(true); setSelected(undefined); },
    onCompositionEnd: () => setComposing(false) };
}
