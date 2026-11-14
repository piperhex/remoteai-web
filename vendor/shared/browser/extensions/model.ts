export interface BrowserExtension {
  id: string; name: string; enabled: boolean; pinned: boolean;
  version?: string; icon?: string; popup: boolean; permissions?: string[];
}
export interface ChromeExtension {
  path: string; profile: string; name: string; version: string; icon?: string; permissions: string[];
}
export type ExtensionRequest = { action: 'list' | 'discover' }
  | { action: 'install'; path: string }
  | { action: 'enable'; id: string; enabled: boolean }
  | { action: 'remove' | 'open'; id: string }
  | { action: 'pin'; id: string; pinned: boolean };
