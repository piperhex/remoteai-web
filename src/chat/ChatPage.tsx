import { t, useLanguage } from '../../../../shared/localization/browserClient';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { usePagePreview } from '../../../../shared/navigation/PageSwipeContext';
import { useAppDispatch } from '../hooks';
import { chatDeviceSelected } from '../store';
import type { AuthSession, RemoteDevice } from '../types';
import { ConnectedChat } from '../../../../shared/remote-chat/views/ConnectedChat';
import { useSshHosts, type ReportSshHost } from '../../../../shared/terminal/workspace/useSshHosts';
import { remoteTerminalApi } from '../../../../shared/remote-chat/terminalApi';
import { ChatTokenSummary } from './ChatTokenSummary';
import { SshPage } from '../discovery/SshPage';
import { RetainedView } from '../../../../shared/RetainedView';
import { ChatTools } from './ChatTools';
import { useChat } from './useChat';
import { useChatViewport } from './useChatViewport';
import { loadLastConnectedDevice, saveLastConnectedDevice } from './lastConnectedDevice';
import { useDownloadConnection } from '../../../../shared/downloads/useDownloadConnection';
import { useRetainedChatDevices } from '../../../../shared/remote-chat/useRetainedChatDevices';
import type { ComputerListRefresh } from '../../../../shared/remote-chat/ComputerSearchBar';
import { useComputerListRefresh } from './useComputerListRefresh';
import { useDesktopLayout } from '../../../../shared/layout/useDesktopLayout';
import { useRemoteCliInstaller } from '../../../../shared/remote-chat/useRemoteCliInstaller';
import { useRemoteTerminalLauncher } from '../../../../shared/remote-chat/useRemoteTerminalLauncher';
import { TerminalWorkspaceProvider } from '../../../../shared/terminal/TerminalWorkspaceProvider';
import { RemoteGuiTools } from '../../../../shared/conversation/remote/RemoteGuiTools';
import { RemoteGuiProject } from '../../../../shared/conversation/remote/RemoteGuiProject';
import './desktopTools.css';
import { ConversationSync } from './ConversationSync';

const DesktopSshPage = lazy(() => import('../discovery/DesktopSshPage'));

interface Props {
  session: AuthSession; devices: RemoteDevice[]; active: boolean; openAccounts?: () => void;
  tokenSummary: boolean; closeTokenSummary: () => void;
  sshDiscovery?: boolean; closeSshDiscovery?: () => void;
  acceptDownload?: boolean;
}

export function ChatPage({ session, devices, active, openAccounts,
  tokenSummary, closeTokenSummary, sshDiscovery, closeSshDiscovery, acceptDownload }: Props) {
  useLanguage();
  const preview = usePagePreview() === 'chat';
  const dispatch = useAppDispatch();
  const deviceRefresh = useComputerListRefresh();
  const [lastConnectedDeviceId] = useState(() => loadLastConnectedDevice(session));
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const device = devices.find((entry) => entry.deviceId === deviceId)
    ?? devices.find((entry) => entry.deviceId === lastConnectedDeviceId && entry.online)
    ?? devices.find((entry) => entry.online);
  useEffect(() => {
    if (device && deviceId !== device.deviceId) setDeviceId(device.deviceId);
  }, [deviceId, device?.deviceId]);
  useEffect(() => {
    dispatch(chatDeviceSelected(device?.deviceId ?? null));
  }, [dispatch, device?.deviceId]);
  useChatViewport(active);
  const scope = JSON.stringify([session.baseUrl, session.email]);
  const desktop = useDesktopLayout();
  const hosts = useSshHosts(scope);
  const retained = useRetainedChatDevices({ scope, devices, selectedId: device?.deviceId, requestedId: hosts.requestedId });
  const chats = device ? retained : [...retained, undefined];
  const chooseDevice = (id: string) => {
    setDeviceId(id);
  };
  return <section className="chat-page" hidden={!active && !preview} aria-label={t("client.chat.codexChat")}>
    {desktop && <RetainedView active={!!sshDiscovery} scope={scope}>
      <Suspense fallback={null}>
        <DesktopSshPage key={scope} active={!!sshDiscovery} scope={scope} defaultHost={hosts.get(device?.deviceId ?? '')}
          directory={{ devices, get: hosts.get, request: hosts.request, refresh: deviceRefresh }} />
      </Suspense>
    </RetainedView>}
    {chats.map(chatDevice => {
      const selected = chatDevice?.deviceId === device?.deviceId;
      return <div className="chat-device-session" hidden={!selected || (desktop && sshDiscovery)}
        key={JSON.stringify([scope, chatDevice?.deviceId])}>
        <WebChat session={session} device={chatDevice} devices={devices} selected={selected} reportHost={hosts.report}
          acceptDownload={acceptDownload && selected}
          tokenSummary={tokenSummary && selected} closeTokenSummary={closeTokenSummary}
          sshDiscovery={sshDiscovery && selected} closeSshDiscovery={closeSshDiscovery}
          openAccounts={openAccounts}
          active={active && selected} chooseDevice={chooseDevice} deviceRefresh={deviceRefresh} />
      </div>;
    })}
  </section>;
}

function WebChat({ session, device, selected, reportHost, ...props }: Props & {
  device?: RemoteDevice; selected: boolean; reportHost: ReportSshHost; chooseDevice: (id: string) => void;
  deviceRefresh: ComputerListRefresh;
}) {
  const chat = useChat(session, device?.deviceId ?? '', props.active && Boolean(device));
  const desktop = useDesktopLayout();
  const terminalApi = useMemo(() => remoteTerminalApi(chat.controller.guiTools.terminal), [chat.controller]);
  const id = device?.deviceId ?? '';
  useEffect(() => {
    reportHost(id, { deviceId: id, name: device?.name ?? '', api: terminalApi, ready: chat.state.ready,
      error: chat.state.connectionIssue });
    return () => reportHost(id);
  }, [reportHost, id, device?.name, terminalApi, chat.state.ready, chat.state.connectionIssue]);
  const [cwd, setWorkspaceCwd] = useState('');
  const terminal = useRemoteTerminalLauncher({ client: chat.controller.guiTools.terminal,
    cwd, connected: chat.state.ready });
  const installer = useRemoteCliInstaller(chat.controller.guiTools,
    desktop && props.active && chat.foreground && chat.state.ready);
  useEffect(() => {
    if (selected && chat.state.ready && device) saveLastConnectedDevice(session, device.deviceId);
  }, [selected, chat.state.ready, device?.deviceId, session.baseUrl, session.email]);
  useDownloadConnection({ session, deviceId: device?.deviceId ?? '', deviceName: device?.name ?? '',
    controller: chat.controller, enabled: selected || desktop, selected });
  return <TerminalWorkspaceProvider panel={terminal}>
    {!desktop && props.sshDiscovery && <SshPage client={chat.controller.guiTools.terminal} connected={chat.state.ready}
      deviceName={device?.name} devices={props.devices} chooseDevice={props.chooseDevice}
      onBack={props.closeSshDiscovery!} />}
    {props.tokenSummary && <ChatTokenSummary read={chat.controller.readTokenSummary} ready={chat.state.ready}
      scope={JSON.stringify([session.baseUrl, session.email, device?.deviceId ?? ''])}
      deviceName={device?.name} onClose={props.closeTokenSummary} />}
    <div hidden={props.sshDiscovery} style={{ display: props.sshDiscovery ? 'none' : 'contents' }}>
    <ConnectedChat {...props} renderHistory={selected} active={props.active && !props.sshDiscovery}
    chat={chat} device={device} email={session.email}
    cliVersion={installer.version}
    onWorkspaceChange={setWorkspaceCwd}
    composerHeader={desktop && <RemoteGuiProject state={chat.state} controller={chat.controller}
      active={props.active && chat.foreground} computers={{ ...props.deviceRefresh, allowLocal: false,
        current: device ?? null, devices: props.devices, authenticated: true, login: () => {},
        choose: selected => { if (selected) props.chooseDevice(selected.deviceId); } }} />}
    headerActions={<div className="chat-header-tools">
      {desktop && device && <ConversationSync session={session} devices={props.devices} deviceId={device.deviceId}
        active={props.active && chat.foreground}
        onSynced={() => { void chat.controller.list(); }} />}
      <ChatTools client={chat.controller.guiTools} active={props.active} terminal={terminal}
        desktopActions={<RemoteGuiTools controller={chat.controller} state={chat.state}
          installer={installer} active={props.active} />}
        connected={chat.state.ready} deviceName={device?.name}
        cwd={cwd} />
    </div>}
    scope={JSON.stringify([session.baseUrl, session.email, device?.deviceId ?? ''])} />
    </div>
  </TerminalWorkspaceProvider>;
}
