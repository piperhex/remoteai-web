import { webChatConnection } from './webChatConnection';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { AuthSession } from '../types';
import { ChatController } from '../../../../shared/remote-chat/client/controller';
import { createBrowserHistoryVersions } from '../../../../shared/remote-chat/browserHistory';
import { createPreviewDownloads } from '../downloads/previews';
import { downloadOwner } from '../../../../shared/downloads/manager';
import { useActiveChatPolicy } from '../../../../shared/remote-chat/useActiveChatPolicy';
import { createWebSshProfiles } from '../sshProfiles';
import { browserDirectoryStorage } from '../../../../shared/chat/directory/storage';

const HISTORY_REFRESH_MS = 15_000;

function createController(session: AuthSession, deviceId: string) {
  const controller = new ChatController(events => webChatConnection(session, deviceId, events),
    undefined, createBrowserHistoryVersions(), createWebSshProfiles(session));
  controller.deferToolDetails = true;
  controller.directoryStorage = browserDirectoryStorage(JSON.stringify([session.baseUrl, session.email]), deviceId);
  controller.deferProcessDetails = true;
  controller.previewDownloads = createPreviewDownloads({ owner: downloadOwner(session), deviceId });
  return controller;
}

export function useChat(session: AuthSession, deviceId: string, active: boolean) {
  // Token refresh keeps the same conversation; reconnect reads the renewed account credentials.
  const controller = useMemo(() => createController(session, deviceId), [session.baseUrl, session.email, deviceId]);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  useActiveChatPolicy(active, state.mode);
  const [foreground, setForeground] = useState(document.visibilityState === 'visible');
  useEffect(() => { controller.setHistoryActive(active && foreground); }, [controller, active, foreground]);
  useEffect(() => {
    const update = () => setForeground(document.visibilityState === 'visible');
    const hide = () => setForeground(false);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', update);
    };
  }, []);
  useEffect(() => {
    // Keep the session and pending requests alive when another page or browser tab is shown.
    if (!deviceId) return;
    controller.start();
    return () => controller.stop();
  }, [deviceId, controller]);
  useEffect(() => {
    if (active && foreground && deviceId) controller.connectNow();
  }, [active, foreground, deviceId, controller]);
  useEffect(() => {
    if (!active || !foreground || (state.mode !== 'direct' && state.mode !== 'relay')) return;
    void controller.refreshSelected();
    const timer = window.setInterval(() => { void controller.refreshSelected(); }, HISTORY_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [active, foreground, controller, state.mode]);
  return { controller, state, foreground };
}
