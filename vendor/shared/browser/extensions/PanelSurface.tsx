import { useRef } from 'react';
import { Alert, Spin } from 'antd';
import type { MarketText } from '../../provider-market/i18n';
import type { usePanelTransport } from './usePanelTransport';
import { usePanelPlacement } from './usePanelPlacement';

const keys = new Set(['Enter', 'Tab', 'Escape', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'Home', 'End']);

export function PanelSurface({ transport, active, title, t }: {
  transport: ReturnType<typeof usePanelTransport>; active: boolean; title: string; t: MarketText;
}) {
  const host = useRef<HTMLDivElement>(null), keyboard = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const preview = usePanelPlacement(host, transport, active);
  const failed = transport.failed || preview.failed;
  return <div ref={host} className="browser-panel-surface" aria-label={title} data-session={transport.session}>
    {!transport.ready && !failed && <Spin />}
    {failed && <Alert type="error" showIcon message={t('market.assistantPanelFailed')} />}
    {preview.image && !failed && <img src={preview.image} alt={title} draggable={false}
      onClick={event => {
        if (transport.native || !active) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        transport.send({ action: 'click', x: event.clientX - bounds.x, y: event.clientY - bounds.y });
        keyboard.current?.focus({ preventScroll: true });
      }} onWheel={event => {
        if (transport.native || !active) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        transport.send({ action: 'scroll', x: event.clientX - bounds.x, y: event.clientY - bounds.y,
          delta: Math.max(-10000, Math.min(10000, event.deltaY)) });
      }} />}
    {!transport.native && <textarea ref={keyboard} className="browser-panel-keyboard" aria-label={t('market.assistantInput')}
      disabled={!active || !transport.ready || failed} autoComplete="off" spellCheck={false}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={event => {
        composing.current = false;
        if (event.currentTarget.value) transport.send({ action: 'text', text: event.currentTarget.value });
        event.currentTarget.value = '';
      }} onChange={event => {
        if (composing.current) return;
        if (event.target.value) transport.send({ action: 'text', text: event.target.value });
        event.target.value = '';
      }} onKeyDown={event => {
        if (composing.current || event.nativeEvent.isComposing || !keys.has(event.key)) return;
        event.preventDefault(); transport.send({ action: 'key', key: event.key });
      }} />}
  </div>;
}
