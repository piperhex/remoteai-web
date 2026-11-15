import { useContext, useEffect, useRef, useState } from 'react';
import { Alert, Button, Spin } from 'antd';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { BrowserClientContext } from '../../file-preview/workspace/browserClient';
import type { MarketText } from '../../provider-market/i18n';
import { command } from './transfer';
import type { AssistantPreferences, AssistantTarget } from './model';

const labels = { chrome: 'market.assistantChrome', agentHub: 'market.assistantAgentHub',
  standalone: 'market.assistantStandalone' } as const;

export function AssistantSettings({ t }: { t: MarketText }) {
  const client = useContext(BrowserClientContext);
  const [preferences, setPreferences] = useState<AssistantPreferences>();
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    let stopped = false;
    generation.current += 1;
    setPreferences(undefined); setError(false); setBusy(false);
    void command(client, { action: 'preferences' }).then(reply => {
      if (!stopped) { setPreferences(reply.preferences); setError(!reply.preferences); }
    }).catch(() => { if (!stopped) setError(true); });
    return () => { stopped = true; generation.current += 1; };
  }, [client]);
  const move = async (target: AssistantTarget, offset: number) => {
    if (!preferences || busy) return;
    const order = [...preferences.order], index = order.indexOf(target), next = index + offset;
    if (next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    const version = generation.current;
    setBusy(true); setError(false);
    try {
      const reply = await command(client, { action: 'preferences', preferences: { order } });
      if (!reply.preferences) throw new Error('Missing browser preferences');
      if (version === generation.current) setPreferences(reply.preferences);
    } catch { if (version === generation.current) setError(true); }
    finally { if (version === generation.current) setBusy(false); }
  };
  return <div className="browser-assistant-settings">
    <strong>{t('market.assistantOrder')}</strong>
    <p>{t('market.assistantOrderHelp')}</p>
    {error && <Alert type="error" showIcon message={t('market.assistantSettingsFailed')} />}
    {!preferences && !error && <Spin />}
    <ol aria-label={t('market.assistantOrder')} aria-busy={busy}>
      {preferences?.order.map((target, index) => <li key={target}>
        <span className="browser-assistant-rank">{index + 1}</span><span>{t(labels[target])}</span>
        <Button type="text" size="small" disabled={busy || index === 0} icon={<ArrowUp size="1em" />}
          aria-label={t('market.assistantMoveUp', { name: t(labels[target]) })} onClick={() => void move(target, -1)} />
        <Button type="text" size="small" disabled={busy || index === preferences.order.length - 1}
          icon={<ArrowDown size="1em" />} aria-label={t('market.assistantMoveDown', { name: t(labels[target]) })}
          onClick={() => void move(target, 1)} />
      </li>)}
    </ol>
    <p>{t(client.native ? 'market.assistantLocalSettings' : 'market.assistantRemoteSettings')}</p>
  </div>;
}
