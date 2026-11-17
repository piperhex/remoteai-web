import { useCliGui } from './context';
import { uiText } from '../localization/uiText';
import { cliEnginesInThreads } from './summary';
import type { Thread } from '../conversation/types';

export function CliListMore({ className, threads }: { className?: string; threads: Thread[] }) {
  const cli = useCliGui();
  const engines = cli ? cliEnginesInThreads(threads, cli.state.sessions).filter(engine => cli.state.listMore?.[engine]) : [];
  if (!cli || !engines.length) return null;
  return <button type="button" className={className} style={{ display: 'block' }} disabled={cli.state.listLoading}
    aria-busy={cli.state.listLoading} onClick={() => void cli.controller.loadMoreSessions(engines)}>
    <span style={{ fontSize: 'calc(1em - 1px)' }}>
      {uiText(cli.state.listLoading ? 'client.projectBrowser.loading' : 'client.chat.loadMore')}
    </span>
  </button>;
}
