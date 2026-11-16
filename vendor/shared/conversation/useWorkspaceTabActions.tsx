import { FileDiff, FolderSearch, GitBranch, Globe } from 'lucide-react';
import { useDiffText } from '../chat/diffText';
import type { WorkspaceTab } from '../chat/workspaceDrawer';
import type { WorkspaceLauncher, WorkspaceLauncherId } from '../chat/workspaceLaunchers';

export interface WorkspaceTabAction extends WorkspaceTab {
  disabled?: boolean;
  open: () => void;
}

export function useWorkspaceTabActions(options: {
  launchers: ReadonlyMap<WorkspaceLauncherId, WorkspaceLauncher>;
  openBrowser?: () => void;
  showChanges?: () => void;
  entries: WorkspaceTab[];
  openTabs: WorkspaceTab[];
  openTab: (id: string) => void;
}) {
  const t = useDiffText();
  const git = options.launchers.get('git');
  const files = options.launchers.get('files');
  const actions: WorkspaceTabAction[] = [
    ...(options.openBrowser ? [{ id: 'preview', title: t('client.configLabels.browser'), icon: <Globe size={16} />,
      open: options.openBrowser }] : []),
    { id: git?.tabId ?? 'git', title: 'Git', icon: <GitBranch size={16} />, disabled: !git?.enabled,
      open: () => git?.open() },
    { id: files?.tabId ?? 'files', title: t('client.projectBrowser.browseFiles'), icon: <FolderSearch size={16} />,
      disabled: !files?.enabled, open: () => files?.open() },
  ];
  if (options.showChanges) actions.push({ id: 'changes', title: t('client.chat.fileChanges.049e14'),
    icon: <FileDiff size={16} />, open: options.showChanges });
  // Registered auxiliary panels can be reopened without losing their retained state.
  for (const tab of options.entries) {
    if (tab.id.startsWith('git:') || tab.id.startsWith('files:')) continue;
    actions.push({ ...tab, open: () => options.openTab(tab.id) });
  }
  return actions.filter(action => !action.disabled && !options.openTabs.some(tab => tab.id === action.id));
}
