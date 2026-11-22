import { lazy, Suspense, type ReactNode } from 'react';
import type { Item } from '../conversation/types';
import { uiText } from '../localization/uiText';
import { messageContent } from './messageDetails';
import { DeferredDetails } from './DeferredDetails';
import { DeferredToolDetails } from './DeferredToolDetails';
const VirtualCommandText = lazy(() => import('../remote-chat/views/VirtualCommandText')
  .then(module => ({ default: module.VirtualCommandText })));

const VISIBLE_PREFIX = 320;

export function DeferredMessageBody({ item, children }: { item: Item; children: (full: Item) => ReactNode }) {
  return <div style={{ overflowWrap: 'anywhere' }}><p>{messageContent(item).slice(0, VISIBLE_PREFIX)}…</p>
    <DeferredDetails summary={<summary>{uiText('client.mobile.fullText')}</summary>}>
      {() => <DeferredToolDetails item={item}>{full => {
        const text = full.type === 'reasoning' ? full.summary?.join('\n') : messageContent(full);
        return text && ['userMessage', 'agentMessage', 'reasoning'].includes(full.type)
          ? <Suspense fallback={null}><VirtualCommandText text={text} label={uiText('client.chat.copyMessage')} /></Suspense>
          : children(full);
      }}</DeferredToolDetails>}
    </DeferredDetails>
  </div>;
}
