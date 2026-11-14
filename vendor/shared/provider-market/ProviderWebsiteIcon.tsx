import { useState, type ReactNode } from 'react';
import { Server } from 'lucide-react';
import { providerIconSources } from './providerWebsite';
import './providerWebsiteIcon.css';

function IconImage({ sources, size, fallback }: { sources: string[]; size: number; fallback: ReactNode }) {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const source = sources[index];
  return <span className="provider-website-icon" style={{ width: size, height: size }} aria-hidden="true">
    {!loaded && fallback}
    {source && <img key={source} src={source} alt="" loading="lazy" decoding="async"
      referrerPolicy="no-referrer" draggable={false} data-loaded={loaded}
      onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setIndex(index + 1); }} />}
  </span>;
}

/** Keep the fallback visible while loading and reset failures when the website changes. */
export function ProviderWebsiteIcon({ url, icons = [], size = 20, fallback = <Server size={size} /> }: {
  url?: string; icons?: string[]; size?: number; fallback?: ReactNode;
}) {
  const sources = [...new Set([...icons, ...providerIconSources(url)])];
  return <IconImage key={sources.join('\n')} sources={sources} size={size} fallback={fallback} />;
}
