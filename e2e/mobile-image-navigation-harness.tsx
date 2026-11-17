import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from 'antd';
import { WebLocaleProvider } from '../src/i18n/WebLocaleProvider';
import { ApplicationTypography } from '../../../shared/appearance/ApplicationTypography';
import { ChatMessages } from '../../../shared/remote-chat/views/ChatMessages';
import { ChatImageContext } from '../../../shared/remote-chat/views/ChatImage';
import { ImageAiContext } from '../../../shared/chat/ImageAiContext';
import type { Turn } from '../../../shared/conversation/types';
import { setThemeMode } from '../src/theme/preference';
import '../src/styles.css';
import '../../../shared/remote-chat/views/chat.css';

const load = async (_thread: string, source: string) => {
  const response = await fetch('/web/image-navigation-image', { method: 'POST', body: source });
  return (await response.json()).url as string;
};
setThemeMode(new URLSearchParams(location.search).has('dark') ? 'dark' : 'light');
function Harness() {
  const [turns, setTurns] = useState<Turn[]>([]);
  useEffect(() => { void fetch('/web/image-navigation-fixture').then(response => response.json()).then(setTurns); }, []);
  const thread = { id: 'gallery', cwd: '', preview: '', updatedAt: 1, turns };
  return <ApplicationTypography><WebLocaleProvider><App>
    <main className="chat-page" style={{ height: '100dvh' }}><div className="chat-conversation">
      <ChatImageContext.Provider value={{ threadId: thread.id, ready: true, load }}>
        <ImageAiContext.Provider value={{ enabled: true, send: async () => true }}>
          <ChatMessages thread={thread} footer={<div className="chat-composer">
            <input aria-label="draft" defaultValue="Keep this draft" /></div>} />
        </ImageAiContext.Provider>
      </ChatImageContext.Provider>
    </div></main>
  </App></WebLocaleProvider></ApplicationTypography>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
