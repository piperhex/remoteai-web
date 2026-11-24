import { remoteErrorText } from '../localization/errors';
import { defaultText } from '../localization/messages';
import { useState, type ReactNode } from 'react';
import { Download, Image as ImageIcon, LoaderCircle } from 'lucide-react';
import { useImageViewer } from './useImageViewer';
import type { PreviewImageLoader } from '../remote-chat/previewProgress';
import { PreviewTransferProgress } from './PreviewTransferProgress';
import { ImageViewerFrame } from './ImageViewerFrame';
import { ImageAiToolbar } from './ImageAiToolbar';
import { useMobileImageViewer } from './useMobileImageViewer';
import type { ImageNavigation } from './ImageGallery';
import { ImageEditor } from './ImageEditor';
import { usePreviewImageAnnotation } from './usePreviewImageAnnotation';
import { getInterfaceLanguage } from '../localization/interfaceLanguage';
import { usePreviewImageMenu, type NativeImageMenu } from './usePreviewImageMenu';

interface Props {
  thumbnail: string; description: string; load: PreviewImageLoader; close: () => void;
  download?: (url: string) => void | Promise<void>;
  imageMenu?: boolean;
  contextMenu?: NativeImageMenu;
  feedback?: string;
  translate?: (text: string) => string;
  formatError?: (error: unknown) => string;
  autoLoadOriginal?: boolean;
  inlineViewControls?: boolean;
  navigation?: ImageNavigation;
}

export function ImageViewer({ thumbnail, description, load, close, download, imageMenu = false, contextMenu, feedback,
  translate = defaultText, formatError = remoteErrorText, autoLoadOriginal = false,
  inlineViewControls = false, navigation }: Props) {
  const image = useImageViewer(load, autoLoadOriginal);
  const source = image.url ?? thumbnail;
  const menu = usePreviewImageMenu({ source, original: image.url, contextMenu, translate });
  const annotation = usePreviewImageAnnotation(image.loadOriginal);
  const [downloadError, setDownloadError] = useState('');
  const [saving, setSaving] = useState(false);
  const mobile = useMobileImageViewer();
  const originalAction = !image.url && !image.loading && <button type="button"
    className={`cs-image-original${mobile ? ' cs-image-original-mobile' : ''}`} onClick={image.request}>
    <ImageIcon size={20} aria-hidden="true" />
    <span>{translate(image.error ? 'client.mobile.reloadOriginalImage' : 'client.chat.viewOriginal')}</span>
  </button>;
  const renderEditor = (viewControls?: ReactNode) => <ImageAiToolbar load={image.loadOriginal}
    close={close} translate={translate} viewControls={viewControls}
    annotation={annotation.available ? annotation : undefined}
    originalAction={mobile ? undefined : originalAction} />;
  if (annotation.editing) return <ImageEditor dataUrl={annotation.editing.source}
    language={getInterfaceLanguage()} translate={translate} mode={annotation.editing.mode}
    save={url => { annotation.save(url); close(); }} close={annotation.cancel} />;
  return <ImageViewerFrame src={source} description={description} close={close}
    navigation={navigation} renderStage={imageMenu ? menu.renderStage : undefined} onEscape={menu.onEscape}
    renderToolbar={inlineViewControls ? renderEditor : undefined}
    translate={translate} onError={image.fail}>
    {mobile && originalAction}
    {download && <button type="button" className="cs-image-download" disabled={saving || image.loading}
      aria-label={translate(saving ? "client.projectBrowser.saving" : "client.shared.downloadImage")} aria-busy={saving}
      onClick={async () => {
        setSaving(true);
        setDownloadError('');
        try { await download(await image.loadOriginal()); }
        catch (error) { setDownloadError(error instanceof Error ? error.message : '下载失败，请重试。'); }
        finally { setSaving(false); }
      }}>{saving ? <LoaderCircle size={24} className="cs-image-download-spinner" aria-hidden="true" />
        : <Download size={24} aria-hidden="true" />}
      <span>{translate(saving ? "client.projectBrowser.saving" : "client.shared.downloadImage")}</span></button>}
    {!inlineViewControls && renderEditor()}
    {image.loading && <div className="cs-image-status cs-image-transfer">
      <PreviewTransferProgress progress={image.progress} label={translate("client.shared.loadingFullImage")} /></div>}
    {downloadError && <div className="cs-image-status" role="status">{formatError(downloadError)}</div>}
    {(feedback || menu.feedback) && <div className="cs-image-status" role="status">{feedback || menu.feedback}</div>}
    {annotation.failed && <div className="cs-image-status" role="alert">
      {translate('client.shared.couldNotEditThisImageOpenItAgainToRetry')}</div>}
    {image.error && <div className="cs-image-status" role="status">{translate("client.shared.couldNotLoadFullImage")}</div>}
  </ImageViewerFrame>;
}
