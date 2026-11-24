import { useContext } from 'react';
import { displayText } from '../../localization/browserClient';
import { EMPTY_IMAGE, useImageGallery, type ImageNavigation } from '../../chat/ImageGallery';
import { useChatImage, type ImagePreviewOptions } from '../client/useChatImage';
import { ImageViewer } from '../../chat/ImageViewer';
import { ImagePreview } from '../../conversation/ImagePreview';
import { FileEnvironmentContext } from '../../conversation/fileEnvironment';
import { remoteImageBytes } from './remoteImageBytes';
import { downloadChatImage } from './downloadImage';

interface Props {
  source: string; description: string; thumbnail?: string; close: () => void;
  options: ImagePreviewOptions | null; inlineViewControls: boolean;
}

export function ChatImagePreview(props: Props) {
  const { current, navigation } = useImageGallery(props);
  return <SelectedImage key={current.source} {...props} source={current.source}
    description={current.description || props.description} navigation={navigation}
    thumbnail={current.source === props.source ? props.thumbnail : undefined} />;
}

function SelectedImage({ source, description, thumbnail, options, close, inlineViewControls, navigation }:
  Props & { navigation: ImageNavigation }) {
  const environment = useContext(FileEnvironmentContext);
  const image = useChatImage(source, options, thumbnail);
  const props = { thumbnail: image.url ?? thumbnail ?? EMPTY_IMAGE, description, load: image.original,
    download: image.save ?? downloadChatImage, close, navigation };
  return environment ? <ImagePreview {...props} prepare={remoteImageBytes} />
    : <ImageViewer {...props} imageMenu inlineViewControls={inlineViewControls} translate={displayText} />;
}
