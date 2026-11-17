import { useState } from 'react';
import { ChatTools } from '../src/chat/ChatTools';
import { ChatDetailsWorkspace } from '../../../shared/remote-chat/views/ChatDetailsWorkspace';
import { ChatTerminalLayout } from '../../../shared/remote-chat/views/ChatTerminalLayout';
import { createAsyncGitFixture } from '../../../shared/remote-chat/testing/gitFixture';
import { createProjectBrowserClient } from '../../../shared/project-browser/protocol';
import { browserRequest, browserRoot } from '../../desktop/e2e/project-browser-fixture';
import type { TerminalInfo } from '../../../shared/terminal/types';
import { client } from './remote-desktop-fixture';

const sessions = new Map<string, TerminalInfo>();
const tools = { ...client, git: createAsyncGitFixture(), projectBrowser: createProjectBrowserClient(browserRequest),
  terminal: { ...client.terminal, list: async () => [...sessions.values()],
    open: async (cwd: string) => {
      const session = { id: `retained-${sessions.size}`, cwd, projectCwd: cwd, shell: 'Fixture shell' };
      sessions.set(session.id, session); return session;
    },
    read: async (id: string, cursor?: number) => ({ found: sessions.has(id), cursor: 1, truncated: false,
      events: cursor ? [] : [{ type: 'output' as const,
        data: Array.from('BACKGROUND_TERMINAL\r\n$ ', character => character.charCodeAt(0)) }] }),
    write: async () => undefined, resize: async () => undefined, close: async (id: string) => { sessions.delete(id); },
  } };

export function RetainedToolsHarness() {
  const [active, setActive] = useState(true);
  const [cwd, setCwd] = useState(browserRoot);
  return <main style={{ height: '100dvh' }}>
    <button onClick={() => setActive(value => !value)}>Toggle page</button>
    <button onClick={() => setCwd(value => value === browserRoot ? 'C:/other' : browserRoot)}>Switch project</button>
    <ChatDetailsWorkspace active={active} selected="retention" enabled>
      <ChatTerminalLayout><ChatTools client={tools} active={active} cwd={cwd} connected
        desktopActions={new URLSearchParams(location.search).has('wide-tools') ? <span /> : undefined} />
      </ChatTerminalLayout>
    </ChatDetailsWorkspace>
  </main>;
}
