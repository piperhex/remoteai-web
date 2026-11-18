import { uiText } from "../../localization/uiText";
import { remoteErrorText } from "../../localization/errors";
import { useState, type ReactNode } from 'react';
import { Alert, Button, Popover, Tooltip } from 'antd';
import { PanelBottom, RefreshCw } from 'lucide-react';
import type { ChatState } from '../../remote-chat/client/types';
import type { ChatController } from '../../remote-chat/client/controller';
import type { TerminalPanelState } from '../../terminal/views/useTerminalPanel';
import { Installer } from '../Installer';
import { CliUpdateIcon } from '../CliUpdateIcon';
import { GuiChatSettingsButton } from '../GuiChatSettingsButton';
import { PanelToggleButton } from '../../chat/PanelToggleButton';
import type { useRemoteCliInstaller } from './useRemoteCliInstaller';
import { useCliGui } from '../../cli-gui/context';
import { CliRuntimeTools } from '../../cli-gui/CliRuntimeTools';

export function RemoteGuiTools({ controller, state, installer, terminal, active, settings }: {
  controller: ChatController; state: ChatState; installer: ReturnType<typeof useRemoteCliInstaller>;
  terminal?: TerminalPanelState & { error?: string; busy?: boolean };
  active: boolean;
  settings?: ReactNode;
}) {
  const connected = state.mode === 'direct' || state.mode === 'relay';
  const cli = useCliGui();
  const external = Boolean(cli && cli.state.engine !== 'codex');
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState('');
  const running = state.sending || Boolean(state.selected?.turns?.some(turn => turn.status === 'inProgress'));
  const terminalLabel = terminal?.open ? uiText("client.chat.hideRemoteTerminal") : uiText("client.chat.openRemoteTerminal");
  const reconnect = async () => {
    if (reconnecting) return;
    if (!connected) { controller.connectNow(); return; }
    setReconnecting(true); setError('');
    try { await controller.guiTools.reconnect(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : uiText("client.workspaceActions.couldNotReconnectRemoteCodexPleaseTryAgainShortly")); }
    finally { setReconnecting(false); }
  };
  return <div className="gui-remote-tools">
    {settings === undefined ? <GuiChatSettingsButton active={active} home={controller.guiTools.settings.home} /> : settings}
    {external ? <CliRuntimeTools refreshModels={controller.refreshModels} /> : <><Tooltip title={uiText("client.workspaceActions.reconnectRemoteCodex")} styles={{ root: { maxWidth: 400 } }}>
      <Button type="text" className="gui-remote-secondary-tool"
        icon={<RefreshCw size={16} />} aria-label={uiText("client.workspaceActions.reconnectRemoteCodex")}
        loading={reconnecting || state.connecting} disabled={running || installer.installing}
        onClick={() => { void reconnect(); }} />
    </Tooltip>
    <Popover trigger="click" placement="bottomRight" styles={{ root: { maxWidth: 400 } }} content={<>
      <Installer installer={installer} compact remote running={running} disabled={!connected} />
      {installer.error && <Alert type="error" message={remoteErrorText(installer.error)} />}
    </>}>
      <Button type="text" className="gui-remote-secondary-tool"
        icon={<CliUpdateIcon version={installer.version} release={installer.release} />}
        aria-label={uiText("client.workspaceActions.remoteCodexCliUpdates")} />
    </Popover></>}
    {terminal && <PanelToggleButton icon={<PanelBottom size={16} />} label={terminalLabel}
      expanded={terminal.open} active={terminal.tabs.length > 0}
      disabled={terminal.busy || (!connected && !terminal.open)}
      onClick={terminal.toggle} />}
    {terminal?.error && !terminal.open && <span role="alert" style={{ maxWidth: 400 }}>
      {remoteErrorText(terminal.error)}
    </span>}
    {error && <Popover open content={<Alert type="error" message={remoteErrorText(error)} closable onClose={() => setError('')} />}
      placement="bottomRight" styles={{ root: { maxWidth: 400 } }}><span /></Popover>}
  </div>;
}
