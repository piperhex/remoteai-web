import { useSyncExternalStore } from 'react';
import { Globe } from 'lucide-react';
import { ProviderWebsiteIcon } from '../../provider-market/ProviderWebsiteIcon';
import { subscribeWebsiteIcons, websiteIconSnapshot } from './websiteIcons';

/** All browser surfaces and bookmarks share discovered icons and the same website fallback. */
export function BrowserWebsiteIcon({ url, size = 16 }: { url?: string; size?: number }) {
  const sources = useSyncExternalStore(subscribeWebsiteIcons, () => websiteIconSnapshot(url));
  return <ProviderWebsiteIcon url={url} icons={sources ? sources.split('\n') : []}
    size={size} fallback={<Globe size={size} />} />;
}
