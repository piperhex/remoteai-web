import { uiText } from "../../localization/uiText";
import type { ChatController, ChatState } from '../../remote-chat/views/types';
import { directoryProject } from '../../remote-chat/projectDirectories';
import { RemoteProjectPicker } from './RemoteProjectPicker';
import { GuiHostPicker } from '../GuiHostPicker';
import { WorkspacePicker } from '../WorkspacePicker';
import { ConversationWorkspaceStatus } from '../ConversationWorkspaceStatus';
import { ProjectBar } from '../ProjectBar';
import { GuiToolbox } from '../GuiToolbox';
import { ProjectBrowserButton } from '../../project-browser/views/ProjectBrowserButton';
import workspaceStyles from '../WorkspacePicker.module.less';
import type { GuiComputerNavigation } from './types';
import { useCliGui } from '../../cli-gui/context';

export function RemoteGuiProject({ state, controller, computers, active }: {
  state: ChatState; controller: ChatController; computers: GuiComputerNavigation; active: boolean;
}) {
  const cli = useCliGui();
  const external = cli && cli.state.engine !== 'codex';
  const selected = external ? cli.state.selected?.id : state.selected?.id;
  const cwd = external ? cli.state.selected?.cwd ?? cli.state.cwd
    : state.selected?.cwd ?? state.draftProject?.cwd ?? '';
  const canChoose = active && state.ready && !selected && !state.sending && !state.workspaceBusy && !cli?.state.busy;
  const choose = (path: string) => {
    if (external) { cli.controller.patch({ cwd: path }); void cli.controller.loadCatalog(); }
    else controller.chooseDraftProject(directoryProject(path));
  };
  return <div className="gui-remote-project">
    <ProjectBar active={active} scope={`${computers.current?.deviceId}:${selected}:${cwd}`} draftDirectory={selected ? undefined : cwd}
      trailing={<GuiHostPicker navigation={computers} active={active} />}>
      <RemoteProjectPicker key={`${computers.current?.deviceId}:${state.selected?.id ?? 'draft'}`}
        state={state} controller={controller} active={active}
        workspace={external ? { cwd, disabled: !canChoose, choose } : undefined} />
      {selected && <ConversationWorkspaceStatus key={`${computers.current?.deviceId}:${cwd}`} cwd={cwd}
        enabled={active && state.ready && !state.workspaceBusy} request={controller.guiTools.workspace} />}
      {!selected && <WorkspacePicker key={cwd} cwd={cwd} disabled={!canChoose}
        remote localLabel={uiText("client.workspaceActions.remoteComputer")} enabled={active && state.ready}
        request={controller.guiTools.workspace} onBusyChange={controller.setWorkspaceBusy}
        onChange={choose} />}
      <GuiToolbox trigger="git" active={active} connected={state.ready && !state.workspaceBusy} cwd={cwd}
        git={controller.guiTools.git} />
      <ProjectBrowserButton client={controller.guiTools.projectBrowser} cwd={cwd}
        active={active} connected={state.ready && !state.workspaceBusy}
        className={workspaceStyles.trigger} desktopStyle />
    </ProjectBar>
  </div>;
}
