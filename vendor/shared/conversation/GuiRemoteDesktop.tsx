import { lazy, Suspense } from 'react';
import { Tooltip } from 'antd';
import { Monitor } from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import type { DesktopClient } from '../remote-desktop/protocol';
import { useDesktopLauncher } from '../remote-desktop/useDesktopLauncher';
import { uiText } from "../localization/uiText";
import { localDesktopClipboard } from '../remote-desktop/local/localClipboard';
import styles from './GuiRemoteDesktop.module.less';

const RemoteDesktop = lazy(() => import('../remote-desktop/views/RemoteDesktop')
  .then(module => ({ default: module.RemoteDesktop })));

export function GuiRemoteDesktop({ client, active, connected, launcher, hideTrigger = false, keepAlive = false }: {
  client: DesktopClient; active: boolean; connected: boolean;
  launcher?: ReturnType<typeof useDesktopLauncher>; hideTrigger?: boolean; keepAlive?: boolean;
}) {
  const internalLauncher = useDesktopLauncher();
  const { opened, minimized, setMinimized, open, close } = launcher ?? internalLauncher;
  const background = opened && minimized && active;
  const label = uiText(background ? "client.remoteDesktop.restoreRemoteDesktop" : "client.remoteDesktop.openRemoteDesktop");
  return <>
    {!hideTrigger && <Tooltip title={label} styles={{ root: { maxWidth: 400 } }}>
      <button type="button" className={styles.launcher} disabled={!active || (!opened && !connected)}
        aria-label={label} aria-expanded={opened && !minimized} data-opened={keepAlive ? opened : undefined} onClick={open}>
        <Monitor size={14} aria-hidden="true" /><span>{uiText("client.remoteDesktop.remoteDesktop")}</span>
        {background && connected && <span className={styles.status} role="status" aria-label={uiText("client.remoteDesktop.runningInTheBackground")} />}
      </button>
    </Tooltip>}
    <Suspense fallback={null}>
      {opened && <RemoteDesktop client={client} active visible={active} connected={connected} close={close}
        keepAlive={keepAlive}
        windowState={{ minimized, setMinimized }} nativeWindow={isTauri()}
        localClipboard={isTauri() ? localDesktopClipboard : undefined} />}
    </Suspense>
  </>;
}
