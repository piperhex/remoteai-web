import { useEffect, useState } from 'react';
import { Alert, Button, Radio, Space, Spin, Typography } from 'antd';
import { FolderOpen } from 'lucide-react';
import { guiLocale, uiText } from '../localization/uiText';
import { ProjectExplorer } from '../project-explorer/ProjectExplorer';
import { pathParts, samePath } from '../project-explorer/model';
import type { HomeChange, HomeClient, HomeLocations } from '../remote-chat/guiSettings';
import styles from './AgentHubHomeSettings.module.less';

export function AgentHubHomeSettings({ client }: { client: HomeClient }) {
  const [state, setState] = useState<HomeLocations>();
  const [attempt, retry] = useState(0);
  const [error, setError] = useState<'load' | 'invalid' | 'failed'>();
  const [draft, setDraft] = useState<HomeChange>();
  const [busy, setBusy] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  useEffect(() => {
    let active = true;
    setError(undefined); setState(undefined); setDraft(undefined); setBrowsing(false);
    void client.read().then(value => { if (active) setState(value); })
      .catch(() => { if (active) setError('load'); });
    return () => { active = false; };
  }, [client, attempt]);
  async function save(change: HomeChange | null) {
    setBusy(true); setError(undefined);
    try { setState(await client.change(change)); setDraft(undefined); }
    catch (reason) {
      const code = reason instanceof Error ? reason.message : String(reason);
      setError(code === 'AGENT_HUB_HOME_INVALID' ? 'invalid' : 'failed');
    } finally { setBusy(false); }
  }
  if (error === 'load') return <Alert type="error" showIcon
    message={uiText('client.workspaceActions.couldNotLoadSettingsPleaseTryAgain')}
    action={<Button size="small" onClick={() => retry(value => value + 1)}>{uiText('client.terminal.retry')}</Button>} />;
  if (!state) return <Spin />;
  const choose = (path: string) => {
    setBrowsing(false); setError(undefined);
    if (samePath(path, state.current)) { setDraft(undefined); return; }
    const previous = state.history.find(home => samePath(home.path, path));
    setDraft({ path: previous?.path ?? path, mode: previous ? 'restore' : 'copy' });
  };
  return <div className={styles.panel}>
    <section>
      <Typography.Text strong>{uiText('client.agentHubHome.current')}</Typography.Text>
      <div className={styles.path}>{state.current}</div>
      <Button icon={<FolderOpen size={16} />} disabled={busy} onClick={() => setBrowsing(true)}>
        {uiText('client.agentHubHome.choose')}</Button>
    </section>
    {state.history.length > 0 && <section>
      <Typography.Text strong>{uiText('client.agentHubHome.history')}</Typography.Text>
      {state.history.map(home => <div key={home.id} className={styles.row}>
        <span className={styles.path}>{home.path}</span>
        <Button size="small" disabled={busy} onClick={() => choose(home.path)}>{uiText('client.agentHubHome.use')}</Button>
      </div>)}
    </section>}
    {draft && <section className={styles.confirm}>
      <Typography.Text strong>{uiText('client.agentHubHome.title')}</Typography.Text>
      <div className={styles.path}>{draft.path}</div>
      {draft.mode !== 'restore' && <Radio.Group value={draft.mode} disabled={busy}
        onChange={event => setDraft({ ...draft, mode: event.target.value })}>
        <Space direction="vertical">
          <Radio value="copy">{uiText('client.agentHubHome.copy')}</Radio>
          <Radio value="fresh">{uiText('client.agentHubHome.fresh')}</Radio>
        </Space>
      </Radio.Group>}
      <Space wrap>
        <Button type="primary" loading={busy} onClick={() => void save(draft)}>{uiText('client.agentHubHome.apply')}</Button>
        <Button disabled={busy} onClick={() => { setDraft(undefined); setError(undefined); }}>{uiText('client.accounts.cancel')}</Button>
      </Space>
    </section>}
    {state.pending && <Alert type="info" showIcon
      message={uiText('client.agentHubHome.pending', { path: state.pending.path })}
      action={<Button size="small" disabled={busy} onClick={() => void save(null)}>{uiText('client.agentHubHome.cancel')}</Button>} />}
    {(error || state.failed) && <Alert type="error" showIcon
      message={uiText(error === 'invalid' ? 'client.agentHubHome.invalid' : 'client.agentHubHome.failed')} />}
    <Typography.Text type="secondary">{uiText('client.agentHubHome.hint')}</Typography.Text>
    {browsing && <ProjectExplorer title={uiText('client.agentHubHome.choose')} cwd={pathParts(state.current).at(-2)?.path ?? ''}
      load={client.load} mutate={client.mutate} close={() => setBrowsing(false)} choose={project => choose(project.cwd)}
      t={uiText} locale={guiLocale()} />}
  </div>;
}
