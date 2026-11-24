import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Copy } from 'lucide-react';
import { copyBrowserImage } from '../clipboardImage';
import { EMPTY_IMAGE } from './ImageGallery';
import { ThreadContextMenu } from './ThreadContextMenu';

export type NativeImageMenu = (event: MouseEvent, currentSource: () => string | undefined, original?: string) => void;

interface Options {
  source: string;
  original?: string;
  contextMenu?: NativeImageMenu;
  translate: (key: string) => string;
}

function displayedSource(image: HTMLImageElement | null) {
  if (image?.isConnected && image.naturalWidth && image.currentSrc !== EMPTY_IMAGE) return image.currentSrc;
}

export function usePreviewImageMenu({ source, original, contextMenu, translate: t }: Options) {
  const [selection, select] = useState<HTMLImageElement | null>(null);
  const [feedback, setFeedback] = useState('');
  const busy = useRef(false);
  const copy = async () => {
    const url = displayedSource(selection);
    select(null);
    if (!url || busy.current) return;
    busy.current = true;
    setFeedback(t('client.workspaceActions.copyingImage'));
    try {
      await copyBrowserImage(url);
      setFeedback(t('client.workspaceActions.imageCopied'));
    } catch {
      setFeedback(t('client.workspaceActions.couldNotCopyTheImagePleaseTryAgain'));
    } finally { busy.current = false; }
  };
  // Keep browser image actions available on HTTP pages and on images served without CORS.
  const browserMenu = !contextMenu && !selection && source !== EMPTY_IMAGE
    && (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined' || /^https?:/i.test(source));
  const renderStage = (stage: ReactNode) =>
    <ThreadContextMenu disabled={browserMenu} open={Boolean(selection)}
      onOpenChange={open => { if (!open) select(null); }}
      getPopupContainer={target => target.closest('dialog') ?? target}
      menu={{ items: [{ key: 'copy', icon: <Copy size={16} />, label: t('client.workspaceActions.copyImage'),
        onClick: () => void copy() }] }}>
      <div className={browserMenu ? 'cs-image-browser-menu' : 'cs-image-menu-target'} tabIndex={0}
        onContextMenuCapture={event => {
          if (browserMenu || busy.current) return;
          const image = event.currentTarget.querySelector('img');
          const url = displayedSource(image);
          if (!url) return;
          if (contextMenu) contextMenu(event, () => displayedSource(image), url === original ? original : undefined);
          else { setFeedback(''); select(image); }
        }}>{stage}</div>
    </ThreadContextMenu>;
  return { renderStage, feedback, onEscape: selection ? () => select(null) : undefined };
}
