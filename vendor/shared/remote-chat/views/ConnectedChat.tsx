import { displayText } from '../../localization/browserClient';
import { TaskRecoveryPrompt } from '../../conversation/recovery/TaskRecoveryPrompt';
import { displayError } from '../../localization/browserClient';
import { ImageAiContext } from '../../chat/ImageAiContext';
import { DesktopUsageContext } from '../../chat/DesktopUsageContext';
import { ProcessDetailsContext } from '../../chat/DeferredProcessDetails';
import { useVisibleChatUsage } from './useVisibleChatUsage';
import { imageAiSender } from '../client/imageAiSender';
import { prepareImageEdit } from './prepareImageEdit';
import { remotePromptSuggestion } from '../client/promptSuggestion';
import { t, useLanguage } from '../../localization/browserClient';
import { useEffect, useState, type ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import type { ChatComputer } from '../devices';
import type { ComputerListRefresh } from '../ComputerSearchBar';
import { ChatApproval } from './ChatApproval';
import { ChatComposer } from './ChatComposer';
import { ChatProjectSwitch } from './ChatProjectSwitch';
import type { NativeFileDrop } from './composerProps';
import { queueProps } from '../client/queueProps';
import { ChatMessages, type RenderUserMessage } from './ChatMessages';
import { EditableChatMessage } from './EditableChatMessage';
import { ChatProcessing } from './ChatProcessing';
import { currentRunningTurn } from '../../chat/runningTurn';
import { ChatImageContext } from './ChatImage';
import { ChatFileContext } from './ChatFileLink';
import { ChatAttachmentMetadata } from './ChatAttachmentMetadata';
import { ChatThreads } from './ChatThreads';
import { ChatThreadFilter } from './ChatThreadFilter';
import { ChatListButton } from './ChatListButton';
import { ChatSidebar } from './ChatSidebar';
import { useDesktopLayout, usePanelVisibility } from '../../layout/useDesktopLayout';
import { ChatDevices } from './ChatDevices';
import { ChatConnectionInfo } from './ChatConnectionInfo';
import { useRemoteCliInstaller } from '../useRemoteCliInstaller';
import { ChatTaskStatus } from './ChatTaskStatus';
import { visibleChatError } from '../chatError';
import { TaskReviewProvider } from '../TaskReviewContext';
import { ChatRetryProvider } from '../ChatRetryProvider';
import { ChatQuotesProvider } from './ChatQuotes';
import { ChatFileReferencesProvider } from '../../chat/ChatFileReferences';
import { ImageAnnotationsProvider } from '../../chat/ImageAnnotations';
import { ChatDetailsWorkspace } from './ChatDetailsWorkspace';
import { ChatBrowserProvider } from './ChatBrowserProvider';
import { ChatTerminalLayout } from './ChatTerminalLayout';
import { ConversationChangesButton } from '../../conversation/ConversationChangesButton';
import { ChatAsyncQuestions } from './ChatAsyncQuestions';
import { ChatSearch } from './ChatSearch';
import { ChatProfileMenu } from './ChatProfileMenu';
import { ChatDesktopAccountPicker } from './ChatDesktopAccountPicker';
import { useChatCatalog } from './useChatCatalog';
import { compactUnavailableReason } from '../client/composerCommands';
import { threadPresentation } from '../sidebar';
import { useChatDrawerSwipe } from './useChatDrawerSwipe';
import type { ChatController, ChatProject, ChatState } from './types';
import './chat.css';
import { ToolDetailsContext } from '../../chat/DeferredToolDetails';
import { CliGuiProvider, useCliGui } from '../../cli-gui/context';
import { CliConversationPane } from '../../cli-gui/CliConversationPane';
import { CliChangesButton } from '../../cli-gui/CliChangesButton';
import { RemoteProjectPicker } from '../../conversation/remote/RemoteProjectPicker';
import { ProjectBar } from '../../conversation/ProjectBar';
import { GuiToolbox } from '../../conversation/GuiToolbox';
import { ProjectBrowserButton } from '../../project-browser/views/ProjectBrowserButton';
import { engineNames } from '../../cli-gui/EngineSelector';
import { RunningConversations } from '../../conversation/RunningConversations';
import { remoteRunningConversations } from '../../conversation/runningConversationEntries';

export interface ConnectedChatProps {
  chat: { state: ChatState; controller: ChatController; foreground: boolean };
  device?: ChatComputer; devices: ChatComputer[]; active: boolean;
  scope: string; email: string; chooseDevice: (id: string) => void;
  chooseLocal?: () => void; accountPicker?: ReactNode; headerActions?: ReactNode;
  deviceRefresh?: ComputerListRefresh;
  headerConnectionActions?: ReactNode; headerEnd?: ReactNode;
  draggableHeader?: boolean;
  scrollableComposer?: boolean;
  renderSidebar?: (actions: ChatSidebarActions) => ReactNode;
  renderUserMessage?: RenderUserMessage;
  composerHeader?: ReactNode;
  cliVersion?: string | null;
  conversationFooter?: ReactNode;
  desktopDiffs?: boolean;
  readClipboardImages?: () => Promise<File[]>;
  nativeFileDrop?: NativeFileDrop;
  openAccounts?: () => void;
  workspacePage?: { title: string; content: ReactNode; onClose: () => void };
  onWorkspaceChange?: (cwd: string) => void;
}

export interface ChatSidebarActions {
  newChat: (project?: ChatProject) => void;
  onClose: () => void;
  openSearch: () => void;
}

/** Conversation UI shared by the web client and the desktop's remote workspace. */
export function ConnectedChat(props: ConnectedChatProps) {
  return <CliGuiProvider key={props.scope} transport={props.chat.controller.cliGui}
    enabled={props.chat.state.ready && props.active && props.chat.foreground}>
    <ConnectedChatContent {...props} />
  </CliGuiProvider>;
}

function ConnectedChatContent({ chat, device, devices, active, scope, email, chooseDevice,
  chooseLocal, accountPicker, headerActions, headerConnectionActions, headerEnd, renderSidebar, composerHeader,
  conversationFooter, renderUserMessage, draggableHeader, scrollableComposer,
  readClipboardImages, nativeFileDrop, desktopDiffs, deviceRefresh, cliVersion, openAccounts,
  workspacePage, onWorkspaceChange }: ConnectedChatProps) {
  useLanguage();
  const cli = useCliGui();
  const external = Boolean(cli && cli.state.engine !== 'codex' && !workspacePage);
  const conversationActive = active && !workspacePage && !external;
  const { state, controller, foreground } = chat;
  const [drawer, setDrawer] = useState(false);
  const desktop = useDesktopLayout();
  const [sidebar, setSidebar] = usePanelVisibility('chat-list');
  const [pickingDevice, setPickingDevice] = useState(false);
  const [searching, setSearching] = useState(false);
  const drawerMotion = useChatDrawerSwipe({ enabled: active && !desktop && !pickingDevice && !searching,
    open: drawer, onOpenChange: setDrawer, onNext: openAccounts });
  const listOpen = desktop ? sidebar : drawerMotion.visible;
  const ListToggleIcon = listOpen ? PanelLeftClose : PanelLeftOpen;
  const closeList = () => { if (desktop) setSidebar(false); else drawerMotion.closeDrawer(); };
  const selectedFromList = () => { workspacePage?.onClose(); if (!desktop) drawerMotion.closeDrawer(); };
  const ready = state.ready;
  const usageSnapshot = useVisibleChatUsage(controller.readUsage, desktop && active && foreground && ready);
  const installer = useRemoteCliInstaller(controller.guiTools,
    cliVersion === undefined && desktop && active && foreground && ready);
  const error = visibleChatError(state.error, state);
  const connectionInfo = <ChatConnectionInfo state={state} controller={controller} device={device}
    active={active && foreground} chooseDevice={() => setPickingDevice(true)} />;
  const cwd = state.selected?.cwd ?? state.draftProject?.cwd ?? '';
  const workspaceCwd = external && cli ? cli.state.selected?.cwd ?? cli.state.cwd : cwd;
  useEffect(() => { onWorkspaceChange?.(workspaceCwd); }, [workspaceCwd, onWorkspaceChange]);
  const catalog = useChatCatalog(controller, cwd, ready);
  const runningTurn = currentRunningTurn(state.selected?.turns);
  const running = Boolean(runningTurn);
  const approvals = state.approvals.filter((event) => event.params.threadId === state.selected?.id);
  const newChat = (project?: ChatProject) => {
    if (cli?.state.busy) return;
    cli?.controller.newConversation();
    if (project?.cwd) cli?.controller.patch({ cwd: project.cwd });
    if (!state.sending) { controller.back(project); drawerMotion.closeDrawer(); }
  };
  useEffect(() => {
    controller.setViewing(conversationActive && foreground
      && (desktop || !drawerMotion.visible) && !pickingDevice && !searching);
  }, [conversationActive, foreground, desktop, drawerMotion.visible, pickingDevice, searching, controller]);
  useEffect(() => {
    if (!active) { drawerMotion.closeDrawer(); setPickingDevice(false); setSearching(false); }
  }, [active, drawerMotion.closeDrawer]);
  const showDesktopDiffs = desktopDiffs ?? desktop;
  const composer = <>
    {!!approvals.length && <div className="chat-approvals chat-scroll">
      {approvals.map((event) => <ChatApproval key={String(event.id)} event={event}
        ready={ready} respond={(reply) => controller.respond(reply)} />)}
    </div>}
    <ChatAsyncQuestions thread={state.selected} error={error}
      scope={scope} active={conversationActive && foreground} dictation={controller.dictation}
      paginated={desktop || desktopDiffs}
      disabled={!ready || state.sending || state.settingsBusy || state.selectedArchived || state.queueBusy
        || state.compacting === state.selected?.id} answer={controller.answerAsyncQuestion} />
    {!external && composerHeader}
    <ChatComposer suggestions={remotePromptSuggestion(state, controller.suggestNextPrompt, { scope })}
      dictation={controller.dictation}
      cliVersion={cliVersion === undefined ? installer.version : cliVersion}
      readServiceStatus={controller.guiTools.serviceStatus}
      serviceStatusConnected={state.mode === 'direct' || state.mode === 'relay'}
      recoveredEdit={controller.messageEditor.recoveredDrafts.get(state.selected?.id ?? '')}
      consumeRecoveredEdit={() => controller.messageEditor.recoveredDrafts.delete(state.selected?.id ?? '')}
      connectionInfo={desktop ? connectionInfo : undefined}
      projectPicker={!composerHeader && <ChatProjectSwitch state={state} controller={controller}
        active={active && (desktop ? foreground : true)} />}
      queue={queueProps(state, controller)} readClipboardImages={readClipboardImages} nativeFileDrop={nativeFileDrop}
      connection={{ client: controller.guiAccounts, deviceName: device?.name ?? t("client.settings.chooseAComputer"),
        chooseDevice: () => setPickingDevice(true) }}
      goals={controller.goals} goal={state.selected ? state.goals?.[state.selected.id] : null} goalBusy={!!state.goalBusy}
      contextSettings={controller.contextSettings} cwd={cwd} catalog={catalog}
      compactReason={compactUnavailableReason(state)} compacting={!!state.compacting
        && state.compacting === state.selected?.id} compact={controller.compact}
      loadCatalog={controller.loadComposerCatalog} loadFiles={controller.loadProjectFiles}
      loadConversations={controller.searchThreads}
      sshProfiles={controller.guiTools.terminal.ssh.profiles}
      uploadProgress={state.upload}
      threadId={state.selected?.id ?? null} draftScope={state.draftScope} models={state.models} selection={state.settings}
      readUsage={controller.readUsage} tokenUsage={state.selected?.tokenUsage}
      readConversationMetrics={controller.readConversationMetrics}
      settingsBusy={state.settingsBusy || !!state.workspaceBusy} settingsError={state.settingsError}
      updateSettings={(settings) => controller.setSettings(settings)}
      refreshModels={controller.refreshModels}
      active={conversationActive} ready={ready && !state.selectedArchived} sending={state.sending} running={running}
      interrupted={state.selected?.turns?.at(-1)?.status === 'interrupted'}
      send={(input) => controller.enqueueMessage(input)} interrupt={() => controller.interrupt()} />
  </>;
  const profileMenu = !accountPicker && (desktop ? <ChatDesktopAccountPicker client={controller.guiAccounts}
    ready={ready} active={active && foreground && !searching} device={device} devices={devices}
    deviceRefresh={deviceRefresh} chooseDevice={chooseDevice} chooseLocal={chooseLocal} />
    : <ChatProfileMenu client={controller.guiAccounts}
    deviceName={device?.name ?? t("client.settings.chooseAComputer")} email={email} ready={ready}
    guiTools={controller.guiTools} active={active && foreground && !searching}
    running={state.sending || running || Object.values(state.sidebar.threads).some(thread => thread.running)}
    chooseDevice={() => { drawerMotion.closeDrawer(); setPickingDevice(true); }} />);
  return <ToolDetailsContext.Provider value={{ load: controller.toolDetails,
    active: conversationActive && foreground && ready }}>
    <ProcessDetailsContext.Provider value={{ load: controller.processDetails,
      active: conversationActive && foreground && ready }}>
    <DesktopUsageContext.Provider value={usageSnapshot}>
    <ImageAiContext.Provider value={{ enabled: conversationActive && ready && !state.selectedArchived
    && !state.sending && !state.settingsBusy && !state.workspaceBusy && !state.compacting,
    send: imageAiSender(controller, prepareImageEdit) }}>
    <ChatImageContext.Provider value={{ threadId: state.selected?.id ?? null, ready,
      load: controller.imagePreview, save: controller.managedPreviews ? controller.savePreviewImage : undefined }}>
    <ChatAttachmentMetadata controller={controller} ready={ready} threadId={state.selected?.id ?? null}>
    <ChatFileContext.Provider value={{ threadId: state.selected?.id ?? null, ready, client: controller.files,
      load: controller.textPreview }}>
    <ChatBrowserProvider controller={controller}>
    <ChatDetailsWorkspace selected={external ? `cli:${cli?.state.engine}:${cli?.state.selected?.id ?? 'draft'}`
      : state.selected?.id ?? null} active={active && !workspacePage} enabled={showDesktopDiffs}>
    <ChatFileReferencesProvider><ImageAnnotationsProvider>
    <ChatQuotesProvider scope={state.draftScope ?? state.selected?.id ?? null} sending={state.sending}
    enabled={conversationActive && !state.selectedArchived}>
    <ChatTerminalLayout>
    <header className={`chat-header${showDesktopDiffs ? ' workspace-toolbar' : ''}`} data-running-conversations-host
      data-tauri-drag-region={draggableHeader || undefined}>
      {desktop ? <button type="button" className="chat-back"
        aria-label={listOpen ? t("client.chat.collapseChatList") : t("client.chat.openChatList")}
        aria-expanded={listOpen} onClick={() => setSidebar(!sidebar)}>
        <ListToggleIcon size={21} />
      </button> : <ChatListButton client={controller.guiAccounts} active={active && foreground} ready={ready}
        expanded={listOpen} onClick={listOpen ? drawerMotion.closeDrawer : drawerMotion.openDrawer} />}
      <div className="chat-grow" data-tauri-drag-region={draggableHeader || undefined}>
        <h2 data-tauri-drag-region={draggableHeader || undefined}>
          {external && cli ? cli.state.selected?.title || t(engineNames[cli.state.engine]) : workspacePage?.title ?? (state.selected
            ? threadPresentation(state.selected, state.sidebar, displayText).title : t("client.chat.newChat"))}</h2>
        {!desktop && connectionInfo}
        {headerConnectionActions}</div>
      {!external && !workspacePage && state.selected && state.selectedArchived && <button type="button" className="chat-button"
        disabled={!ready || running}
        onClick={() => { void controller.archive().then(drawerMotion.openDrawer); }}>
        {t("client.chat.restore")}</button>}
      {headerActions}
      {!workspacePage && showDesktopDiffs && (external ? <CliChangesButton /> : <ConversationChangesButton
        value={state.selected?.turns ? { turns: state.selected.turns } : undefined} />)}
      {headerEnd}
      {(desktop || draggableHeader) && <RunningConversations entries={remoteRunningConversations(state)}
        selected={state.selected?.id ?? null} disabled={state.sending || !ready}
        onSelect={id => {
          if (state.archived || state.search) void controller.list({ archived: false, search: '' });
          void controller.openRecoveryThread(id);
        }} onOpen={selectedFromList} />}
    </header>
    {external && cli && <CliConversationPane cwd={cwd} dictation={controller.dictation} remoteLayout
      readClipboardImages={readClipboardImages} nativeFileDrop={nativeFileDrop}
      connected={ready}
      connection={{ client: controller.guiAccounts, deviceName: device?.name ?? t('client.settings.chooseAComputer'),
        chooseDevice: () => setPickingDevice(true) }}
      active={active && foreground} scrollableComposer={scrollableComposer}
      composerHeader={composerHeader}
      connectionInfo={desktop ? connectionInfo : undefined}
      projectPicker={composerHeader ? undefined : !desktop
        ? <ChatProjectSwitch state={state} controller={controller} active={active && foreground} workspace={{
          cwd: workspaceCwd, disabled: !ready || Boolean(cli.state.selected) || cli.state.busy,
          choose: cwd => { cli.controller.patch({ cwd }); void cli.controller.loadCatalog(); },
        }} /> : <ProjectBar active={active} scope={workspaceCwd}>
        <RemoteProjectPicker state={state} controller={controller} active={active} workspace={{
          cwd: workspaceCwd, disabled: Boolean(cli.state.selected) || cli.state.busy,
          choose: cwd => { cli.controller.patch({ cwd }); void cli.controller.loadCatalog(); },
        }} />
        <GuiToolbox trigger="git" active={active} connected={ready} cwd={workspaceCwd} git={controller.guiTools.git} />
        <ProjectBrowserButton client={controller.guiTools.projectBrowser} cwd={workspaceCwd}
          active={active} connected={ready} desktopStyle />
      </ProjectBar>} />}
    {workspacePage && <div className="gui-remote-feature">{workspacePage.content}</div>}
    <TaskRecoveryPrompt client={controller.taskRecovery}
      enabled={active && (desktop || Boolean(draggableHeader)) && ready && state.taskRecoverySupported === true}
      openThread={threadId => {
        cli?.controller.showCodex();
        workspacePage?.onClose();
        void controller.openRecoveryThread(threadId);
      }} />
    <div className="cli-gui-codex-content" hidden={external}>
    <div className="chat-scroll chat-notices"><div className="chat-notice-content">
      <ChatTaskStatus state={state} />
      {!!error && <p role="alert" className="chat-error">{displayError(error)}</p>}
      {state.desktopOnly && <p className="chat-muted">
        {t("client.remoteDesktop.theDesktopIsReadyOpenRemoteDesktopAndSignIn")}</p>}
    </div></div>
      <TaskReviewProvider controller={controller} state={state} active={conversationActive && foreground}>
      <ChatRetryProvider controller={controller} state={state}>
      <ChatMessages thread={state.selected} offline={!ready} active={conversationActive && foreground}
        footer={scrollableComposer ? composer : undefined}
        renderUserMessage={renderUserMessage ?? (desktop ? props => <EditableChatMessage {...props}
          state={state} controller={controller} active={conversationActive && foreground} /> : undefined)}
        loading={state.historyLoading} loadingMore={state.historyLoadingMore} hasMore={state.historyHasMore}
        loadOlder={() => controller.loadOlder()} historyLoad={state.historyLoad}
        processing={runningTurn && <ChatProcessing key={runningTurn.id} turn={runningTurn}
          processing={state.processing} active={conversationActive && ready} />} />
      </ChatRetryProvider></TaskReviewProvider>
    {!scrollableComposer && composer}
    </div>
    {conversationFooter}
    </ChatTerminalLayout>
    <ChatSidebar desktop={desktop} open={listOpen} onClose={closeList} customHeading={Boolean(renderSidebar)}
      motion={drawerMotion}
      headingExtra={!renderSidebar && <>
        <ChatThreadFilter state={state} controller={controller} />
        {desktop && <button className="chat-back chat-sidebar-new" type="button"
          aria-label={t("client.chat.newChat")} title={t("client.chat.newChat")}
          disabled={state.sending} onClick={() => newChat()}><Plus size={20} aria-hidden="true" /></button>}
      </>}>
      {renderSidebar ? renderSidebar({ newChat, onClose: selectedFromList, openSearch: () => setSearching(true) })
        : <ChatThreads state={state} controller={controller} newChat={newChat} onClose={selectedFromList}
        openSearch={() => setSearching(true)} accountPicker={accountPicker ?? (desktop ? profileMenu : undefined)}
        profile={!desktop && profileMenu} />}
    </ChatSidebar>
    {searching && <ChatSearch state={state} controller={controller} onClose={() => setSearching(false)}
      select={thread => { cli?.controller.showCodex(); workspacePage?.onClose(); setSearching(false);
        drawerMotion.closeDrawer(); void controller.select(thread); }} />}
    {pickingDevice && <ChatDevices chooseLocal={chooseLocal} devices={devices} onClose={() => setPickingDevice(false)}
      refresh={deviceRefresh} choose={(id) => { chooseDevice(id); setPickingDevice(false); }} />}
  </ChatQuotesProvider></ImageAnnotationsProvider></ChatFileReferencesProvider>
  </ChatDetailsWorkspace></ChatBrowserProvider>
  </ChatFileContext.Provider></ChatAttachmentMetadata></ChatImageContext.Provider></ImageAiContext.Provider>
  </DesktopUsageContext.Provider></ProcessDetailsContext.Provider></ToolDetailsContext.Provider>;
}
