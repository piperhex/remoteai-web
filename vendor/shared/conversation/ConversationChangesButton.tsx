import { useContext, useEffect, useId, useMemo } from "react";
import { PanelRight, PanelRightClose } from "lucide-react";
import { PanelToggleButton } from '../chat/PanelToggleButton';
import { WorkspaceDrawerContext } from '../chat/workspaceDrawer';
import type { Conversation } from "./types";
import { useTurnChangedFiles } from "./useTurnChangedFiles";
import { useDetailsEntry } from "./detailsContext";
import { useDiffText } from "../chat/diffText";
import type { GitClient } from '../remote-chat/gitTypes';
import { turnReview } from './turnReview';

export function ConversationChangesButton({ value, git, cwd = '', threadId }: {
  value?: Pick<Conversation, 'turns'>; git?: GitClient; cwd?: string; threadId?: string;
}) {
  const t = useDiffText();
  const id = useId();
  const turn = value?.turns.at(-1);
  const files = useTurnChangedFiles(turn);
  const title = t("client.chat.fileChanges.049e14");
  const entry = useMemo(() => ({ id, title, files, turnReview: turnReview(turn, threadId),
    workspaceReview: git ? { git, cwd, turns: value?.turns } : undefined }),
  [id, files, title, turn, threadId, git, cwd, value?.turns]);
  const panel = useDetailsEntry(entry);
  const workspace = useContext(WorkspaceDrawerContext);
  const register = panel?.setConversationChanges;
  useEffect(() => { register?.(entry); }, [register, entry]);
  const showingChanges = Boolean(panel?.visible && panel.showingChanges);
  const sidebar = Boolean(workspace && !git && !files.length);
  const showingStart = Boolean(workspace?.tabs.visible && workspace.tabs.selected === 'start');
  const expanded = sidebar ? Boolean(workspace?.visible) : showingChanges || showingStart;
  const label = sidebar ? t('client.desktopGuiExtras.sidebarContent')
    : t(showingChanges ? "client.chat.hideFileChanges" : "client.chat.viewFileChanges");
  return <PanelToggleButton icon={expanded ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
    label={label} expanded={expanded} active={workspace?.hasOpenTabs ?? Boolean(panel?.visible)}
    onClick={() => {
      if (expanded) panel?.close();
      else if (sidebar) workspace?.open();
      else panel?.open(entry);
    }} />;
}
