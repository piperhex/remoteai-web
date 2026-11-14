import { useRef } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { Button, Progress } from 'antd';
import { FolderOpen, Upload } from 'lucide-react';
import { useFileDrop, type SubscribeFileDrop } from '../../chat/useFileDrop';
import type { MarketText } from '../../provider-market/i18n';
import type { useExtensions } from './useExtensions';

const subscribe: SubscribeFileDrop | undefined = isTauri()
  ? listener => getCurrentWebview().onDragDropEvent(event => listener(event.payload)) : undefined;

export function ExtensionDropZone({ extensions, t, browse }: {
  extensions: ReturnType<typeof useExtensions>; t: MarketText; browse: () => void;
}) {
  const target = useRef<HTMLDivElement>(null);
  const drop = useFileDrop({ target, scope: 'browser-extensions', active: true,
    disabled: extensions.busy || !extensions.supported, subscribe,
    addPaths: async paths => { await extensions.installPaths(paths); },
    // The DOM drop handler below preserves folder entries; the shared hook supplies native hit testing.
    addFiles: async () => {}, report: () => extensions.reportError('market.extensionsFailed'),
  });
  return <div ref={target} className="browser-extension-drop" data-dragging={drop.dragging || undefined}
    {...drop.handlers} onDrop={event => {
      event.preventDefault(); event.stopPropagation(); drop.clearDrag();
      if (!subscribe && !extensions.busy && extensions.supported) void extensions.installDrop(event.dataTransfer);
    }}>
    <span className="browser-extension-drop-icon"><Upload size="1.5em" /></span>
    <div className="browser-extension-drop-copy"><strong>{t('market.extensionsDropTitle')}</strong>
      <span>{t(extensions.native ? 'market.extensionsDropHint' : 'market.extensionsRemoteDropHint')}</span></div>
    <Button icon={<FolderOpen size="1.15em" />} disabled={extensions.busy || !extensions.supported}
      onClick={browse}>{t('market.extensionsBrowse')}</Button>
    {extensions.progress !== undefined && <Progress percent={extensions.progress} size="small" />}
  </div>;
}
