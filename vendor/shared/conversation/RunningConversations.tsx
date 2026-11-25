import { useId, useState, type CSSProperties } from 'react';
import { theme, Tooltip } from 'antd';
import { resources as desktopText } from '@remoteai/i18n/desktop';
import { ChevronUp, CircleAlert, ListVideo, LoaderCircle } from 'lucide-react';
import { useCliGui } from '../cli-gui/context';
import { useGuiLanguage } from '../localization/useGuiLanguage';
import { uiText } from '../localization/uiText';
import { conversationTps, type ReadConversationMetrics } from '../remote-chat/conversationMetrics';
import { useConversationMetricsForThreads } from '../remote-chat/client/useConversationMetrics';
import type { RunningConversation } from './runningConversationEntries';
import styles from './RunningConversations.module.less';

export function RunningConversations({ entries, selected, disabled, readMetrics, onSelect, onOpen }: {
  entries: RunningConversation[];
  selected: string | null;
  disabled?: boolean;
  readMetrics?: ReadConversationMetrics;
  onSelect: (id: string) => void;
  onOpen: () => void;
}) {
  const language = useGuiLanguage();
  const cli = useCliGui();
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);
  const listId = useId();
  const sessions = new Map((cli?.state.sessions ?? []).map(session => [`cli:${session.engine}:${session.id}`, session]));
  if (cli?.state.selected) {
    const session = cli.state.selected;
    sessions.set(`cli:${session.engine}:${session.id}`, session);
  }
  const items = [...entries.map(entry => ({ ...entry, metricsId: entry.id })), ...[...sessions].filter(([, session]) =>
    session.status === 'running' || (session.permissionCount ?? session.permissions.length) > 0).map(([id, session]) => ({
    id, title: session.title, cwd: session.cwd, needsInput: (session.permissionCount ?? session.permissions.length) > 0,
    metricsId: session.metricsSessionId,
  }))];
  const ids = items.flatMap(item => item.metricsId ? [item.metricsId] : []);
  const metrics = useConversationMetricsForThreads(collapsed ? undefined : readMetrics, ids);
  const speeds = items.map(item => conversationTps(item.metricsId ? metrics.get(item.metricsId) : null));
  const measured = speeds.filter((speed): speed is number => speed !== null);
  const mean = measured.length ? measured.reduce((sum, speed) => sum + speed, 0) / measured.length : null;
  if (!items.length) return null;
  const current = cli?.state.engine !== 'codex' && cli?.state.selected
    ? `cli:${cli.state.engine}:${cli.state.selected.id}` : selected;
  const style = { fontSize: token.fontSize, lineHeight: token.lineHeight,
    '--running-row-height': '4em' } as CSSProperties;
  const label = uiText('client.chat.inProgress');
  return <aside className={`${styles.panel} ${collapsed ? styles.collapsed : ''}`} style={style}
    aria-label={label} data-running-conversations>
    {collapsed ? <Tooltip title={label} placement="left" styles={{ root: { maxWidth: 400 } }}>
      <button type="button" className={styles.toggle} aria-label={uiText('client.composer.expandConversationList')}
        aria-expanded={false} aria-controls={listId} onClick={() => setCollapsed(false)}>
        <ListVideo aria-hidden size="1.25em" />
      </button>
    </Tooltip> : <>
      <div className={styles.heading}><ListVideo size="1.2em" aria-hidden />
        <strong>{label}</strong><span className={styles.count}>{items.length}</span>
        {mean !== null &&
          <Tooltip title={desktopText[language]['table.conversationTpsLabel']} styles={{ root: { maxWidth: 400 } }}>
            <span className={styles.average} data-running-average>{mean.toFixed(1)} TPS</span>
          </Tooltip>}
        <button type="button" className={styles.toggle} aria-label={uiText('client.composer.collapseConversationList')}
          aria-expanded aria-controls={listId} onClick={() => setCollapsed(true)}>
          <ChevronUp size="1.2em" aria-hidden />
        </button>
      </div>
      <div id={listId} className={styles.list} data-running-conversations-list>
        {items.map((entry, index) => <RunningConversationRow key={entry.id} entry={entry} speed={speeds[index]}
          selected={current === entry.id}
          disabled={disabled || cli?.state.busy} onSelect={() => {
            const session = sessions.get(entry.id);
            if (session) cli?.controller.open(session);
            else { cli?.controller.showCodex(); onSelect(entry.id); }
            onOpen();
          }} />)}
      </div>
    </>}
  </aside>;
}

function RunningConversationRow({ entry, selected, speed, disabled, onSelect }: {
  entry: RunningConversation; selected: boolean; speed: number | null; disabled?: boolean; onSelect: () => void;
}) {
  const speedId = useId();
  const title = entry.title || uiText('client.chat.newChat');
  const project = entry.projectName || entry.cwd.split(/[\\/]/).filter(Boolean).at(-1);
  return <button type="button" className={styles.row} disabled={disabled} aria-label={title}
    aria-current={selected ? 'page' : undefined} aria-describedby={speed !== null ? speedId : undefined}
    onClick={onSelect}>
    {entry.needsInput ? <CircleAlert size="1.15em" className={styles.attention}
      aria-label={uiText('client.shared.waitingForYourInput')} />
      : <LoaderCircle size="1.15em" className={styles.spinner} aria-label={uiText('client.chat.replying')} />}
    <Tooltip title={title} placement="left" styles={{ root: { maxWidth: 400 } }}>
      <span className={styles.text}><span className={styles.title}>{title}</span>
        {(project || speed !== null) && <span className={styles.details}><span className={styles.project}>{project}</span>
          {speed !== null && <span id={speedId} className={styles.speed}>{speed.toFixed(1)} TPS</span>}
        </span>}
      </span>
    </Tooltip>
  </button>;
}
