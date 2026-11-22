import { createContext, useContext, type ReactNode } from 'react';
import { guiApi } from '../conversation/api';
import type { Item } from '../conversation/types';
import { uiText } from '../localization/uiText';

import { useProcessDetails, type ProcessDetailsLoader } from './useDeferredDetails';
export type { ProcessDetailsLoader } from './useDeferredDetails';
export const ProcessDetailsContext = createContext<{ load: ProcessDetailsLoader; active: boolean }>({
  load: target => guiApi.request({ operation: 'processDetails', ...target }), active: true,
});
function LoadedProcess({ items, active, children }: {
  items: Item[]; active: boolean; children: (items: Item[]) => ReactNode;
}) {
  const context = useContext(ProcessDetailsContext);
  const { loaded, error, retry } = useProcessDetails(items, context.load, context.active && active);
  if (error) return <p role="status"><button type="button" onClick={retry}>
    {uiText('client.chat.couldNotLoadSelectToRetry')}</button></p>;
  return loaded ? children(loaded) : <p role="status">{uiText('client.mobile.loading')}</p>;
}

/** Only mount inside an explicitly opened process; collapsing releases all loaded rows. */
export function DeferredProcessDetails({ items, active = true, children }: {
  items: Item[]; active?: boolean; children: (items: Item[]) => ReactNode;
}) {
  return items.some(item => item.processRef)
    ? <LoadedProcess items={items} active={active}>{children}</LoadedProcess> : children(items);
}
