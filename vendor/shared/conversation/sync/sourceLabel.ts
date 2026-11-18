import { SYNC_HOME_ID, type SyncHome, type SyncSource } from './types';

import { uiText } from '../../localization/uiText';

const previousHome = (home: SyncHome) => home.id.startsWith('previous:');

const GUI_APP_DIRECTORY = 'dev.codex.switch';
export const GUI_HOME_NAME = 'CodexGUI';

export function isGuiSyncHome(home: SyncHome) {
  if (previousHome(home)) return false;
  return home.id === SYNC_HOME_ID || home.path.split(/[\\/]/)
    .some(segment => segment.toLowerCase() === GUI_APP_DIRECTORY);
}

export function syncSourceLabel(computer: string, home: SyncHome) {
  if (previousHome(home)) return `${computer} · ${uiText('client.agentHubHome.inactive')} · ${home.path}`;
  const gui = isGuiSyncHome(home);
  return `${computer} · ${gui ? GUI_HOME_NAME : home.path}`;
}

export function orderSyncSources(sources: SyncSource[]) {
  return [...sources].sort((left, right) => Number(isGuiSyncHome(right.home)) - Number(isGuiSyncHome(left.home)));
}
