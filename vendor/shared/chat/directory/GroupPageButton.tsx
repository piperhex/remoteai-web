import { useState } from 'react';
import { uiText } from '../../localization/uiText';

export function GroupPageButton({ cursor, load, enabled = true, className, busy = false }: {
  cursor?: string | null; load: (more: boolean) => Promise<void>; enabled?: boolean; className?: string; busy?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  if (!enabled || cursor === null) return null;
  return <button type="button" className={className} style={{ display: 'block' }}
    disabled={loading || busy} aria-busy={loading || busy}
    onClick={() => {
      setLoading(true);
      void load(Boolean(cursor)).finally(() => setLoading(false));
    }}><span style={{ fontSize: 'calc(1em - 1px)' }}>
      {uiText(loading || busy ? 'client.projectBrowser.loading' : 'client.chat.loadMore')}
    </span></button>;
}
