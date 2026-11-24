import { useMemo } from 'react';
import { ConversationChangesButton } from '../conversation/ConversationChangesButton';
import { useCliGui } from './context';
import { cliThread } from './presentation';

export function CliChangesButton({ git, cwd }: {
  git?: import('../remote-chat/gitTypes').GitClient; cwd?: string;
}) {
  const cli = useCliGui();
  const history = cli?.state.history ?? null;
  const thread = useMemo(() => cliThread(history), [history]);
  return <ConversationChangesButton git={git} cwd={cwd} threadId={thread?.id}
    value={thread?.turns ? { turns: thread.turns } : undefined} />;
}
