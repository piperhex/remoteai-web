import { createContext, useContext, type ReactNode } from 'react';
import type { Item } from '../conversation/types';
import { guiApi } from '../conversation/api';
import { uiText } from '../localization/uiText';
import { useToolDetails, type ToolDetailsLoader } from './useDeferredDetails';
export type { ToolDetailsLoader } from './useDeferredDetails';
export const localToolDetails: ToolDetailsLoader = target => guiApi.request({ operation: 'toolDetails', ...target });
export const ToolDetailsContext = createContext<{ load: ToolDetailsLoader; active: boolean }>({
  load: localToolDetails, active: true,
});

function LoadedDetails({ item, children, onLoad }: {
  item: Item; children: (item: Item) => ReactNode; onLoad?: (item: Item) => void;
}) {
  const { load, active } = useContext(ToolDetailsContext);
  const { loaded, error, retry } = useToolDetails(item, load, active, onLoad);
  return <>
    {error ? <p role="status"><button type="button" onClick={retry}>
      {uiText('client.chat.couldNotLoadSelectToRetry')}</button></p>
      : !loaded && <p role="status">{uiText('client.mobile.loading')}</p>}
    {loaded && children(loaded)}
  </>;
}

/** Mount only inside an opened detail view. Unmounting releases its payload and stops refreshes. */
export function DeferredToolDetails({ item, children, onLoad }: {
  item: Item; children: (item: Item) => ReactNode; onLoad?: (item: Item) => void;
}) {
  if (!item.detailsRef) return children(item);
  const key = JSON.stringify(item.detailsRef);
  return <LoadedDetails key={key} item={item} onLoad={onLoad}>{children}</LoadedDetails>;
}
