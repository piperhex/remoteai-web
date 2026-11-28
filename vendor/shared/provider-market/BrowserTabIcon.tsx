import { History, KeyRound } from 'lucide-react';
import type { BrowserTab } from './browserState';
import { BrowserWebsiteIcon } from '../browser/icons/BrowserWebsiteIcon';

export function BrowserTabIcon({ tab, loading }: { tab: BrowserTab; loading: boolean }) {
  const DataIcon = tab.dataPage?.kind === 'history' ? History : KeyRound;
  return <span className="pm-browser-tab-icon" aria-hidden="true" data-loading={loading}>
    {tab.dataPage ? <DataIcon size={14} /> : tab.automationThread
      ? <svg className="pm-browser-controlled-icon" width={14} height={14} viewBox="0 0 32 32">
      <path d="M7 3v24l7-7 5 10 5-2-5-10h9L7 3Z" fill="white" stroke="#16a34a"
        strokeWidth={2.5} strokeLinejoin="round" />
    </svg> : <BrowserWebsiteIcon url={tab.url} size={14} />}
    {loading && <svg className="pm-browser-tab-ring" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="7" pathLength="100" />
    </svg>}
  </span>;
}
