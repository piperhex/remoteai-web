import { displayText } from '../../localization/browserClient';
import { useLanguage } from '../../localization/browserClient';
import { ImageEditor } from '../../chat/ImageEditor';
import type { DraftImage } from '../attachments';

export function ChatImageEditor({ image, save, close }: {
  image: DraftImage; save: (dataUrl: string) => void; close: () => void;
}) {
  const language = useLanguage();
  return <ImageEditor dataUrl={image.url} save={save} close={close} translate={displayText}
    language={language} />;
}
