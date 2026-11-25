import { createContext, useContext, useEffect } from "react";
import type { DiffFile } from "./diff";
import type { FileReference } from "./fileReference";
import type { FilePreviewOptions, WebsitePreviewOptions } from "../file-preview/workspace/usePreviewHistory";
import type { BrowserResource } from '../file-preview/workspace/browserResources';

export interface TurnReview {
  threadId?: string; turnId?: string; cwd?: string; summary?: string;
  observation?: import('./types').Turn['workspaceObservation'];
  activity?: string[][];
  deferred?: boolean;
  result: import('./savedReview').ReviewResult;
}
export interface DiffPanelEntry {
  id: string; title: string; files: readonly DiffFile[]; status?: string; filePath?: string;
  turnReview?: TurnReview;
  savedFile?: number;
  workspaceReview?: { git: import('../remote-chat/gitTypes').GitClient; cwd: string; turns?: import('./types').Turn[] };
  initialReview?: 'turn';
}
interface DetailsContextValue {
  readSavedReview?: import('./savedReview').ReadSavedReview;
  open: (entry: DiffPanelEntry) => void;
  update: (entry: DiffPanelEntry) => void;
  setConversationChanges: (entry: DiffPanelEntry) => void;
  openFile: (target: FileReference & { threadId: string | null }, options?: FilePreviewOptions) => Promise<boolean>;
  openResource?: (resource: BrowserResource) => void;
  openRemoteFile?: (target: FileReference & { threadId: string | null }) => Promise<boolean>;
  openWebsite: (url: string, options?: WebsitePreviewOptions) => void;
  showingChanges: boolean;
  visible: boolean;
  close: () => void;
}
export const DetailsContext = createContext<DetailsContextValue | null>(null);

export function useDetailsEntry(entry: DiffPanelEntry) {
  const panel = useContext(DetailsContext);
  const update = panel?.update;
  useEffect(() => { update?.(entry); }, [update, entry]);
  return panel;
}
