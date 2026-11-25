import { ResizableSidebar, type ResizableSidebarProps } from '../layout/ResizableSidebar';
import type { SidebarSizing } from '../layout/useSidebarResize';

const COMPACT_VIEWPORT = 1150;
const THREAD_SIDEBAR: SidebarSizing = {
  storageKey: 'codex-switch:gui-sidebar-width',
  minimum: 200,
  maximum: 520,
  minimumContent: 320,
  defaultWidth: (_available, viewport) => viewport <= COMPACT_VIEWPORT ? 200 : 236,
};

export function ResizableThreadSidebar(props: Omit<ResizableSidebarProps, 'sizing'>) {
  return <ResizableSidebar {...props} sizing={THREAD_SIDEBAR} />;
}
