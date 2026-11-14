import { createContext } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { invoke } from '../../platform/localBackend';
import { guiApi } from '../../conversation/api';
import { browserEvent, type BrowserClient } from '../../browser/automation';

export const localBrowserClient: BrowserClient = {
  native: isTauri(),
  browseFiles: (directory, includeFiles = true) => guiApi.request({
    operation: 'projectDirectories', directory, includeFiles,
  }),
  request: request => invoke('codex_gui_browser', { request }),
  subscribe: callback => guiApi.subscribe(event => { const browser = browserEvent(event); if (browser) callback(browser); }),
};
export const BrowserClientContext = createContext(localBrowserClient);
