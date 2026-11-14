import { useMemo, type ReactNode } from 'react';
import type { ChatController } from '../client/controller';
import { browserEvent, type BrowserClient } from '../../browser/automation';
import { BrowserClientContext } from '../../file-preview/workspace/browserClient';

export function ChatBrowserProvider({ controller, children }: { controller: ChatController; children: ReactNode }) {
  const client = useMemo<BrowserClient>(() => ({ native: false,
    browseFiles: controller.loadProjectDirectories,
    request: request => controller.guiTools.browser(request),
    subscribe: async callback => controller.subscribeEvents(event => {
      const browser = browserEvent(event); if (browser) callback(browser);
    }),
  }), [controller]);
  return <BrowserClientContext.Provider value={client}>{children}</BrowserClientContext.Provider>;
}
