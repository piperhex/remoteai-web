import { useId, useRef, type ReactNode } from 'react';
import { useSidebarResize, type SidebarSizing } from './useSidebarResize';
import styles from './ResizableSidebar.module.less';

export interface ResizableSidebarProps {
  children: ReactNode;
  className: string;
  layoutSelector: string;
  resizeLabel: string;
  label?: string;
  sizing: SidebarSizing;
}

export function ResizableSidebar({
  children, className, layoutSelector, resizeLabel, label, sizing,
}: ResizableSidebarProps) {
  const sidebar = useRef<HTMLElement>(null);
  const id = useId();
  const resize = useSidebarResize(sidebar, layoutSelector, sizing);
  return <aside ref={sidebar} id={id} className={`${styles.sidebar} ${className}`} aria-label={label}
    style={{ width: resize.enabled ? resize.width : undefined }} data-resizing={resize.dragging || undefined}>
    {children}
    {resize.enabled && <div className={styles.handle} role="separator" tabIndex={0}
      aria-label={resizeLabel} aria-orientation="vertical" aria-controls={id}
      aria-valuemin={resize.minimum} aria-valuemax={resize.maximum} aria-valuenow={resize.width} {...resize.handle} />}
  </aside>;
}
