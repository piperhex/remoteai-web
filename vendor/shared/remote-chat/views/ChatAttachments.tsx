import { t, useLanguage } from '../../localization/browserClient';
import { DraftImagePreviews } from '../../chat/DraftImagePreviews';
import { MAX_CHAT_IMAGES, type DraftImage } from '../attachments';
import { itemUploadProgress, type UploadProgress } from '../uploadProgress';
import { ChatUploadProgress } from './ChatUploadProgress';

export function ChatAttachmentPreviews({ images, busy, remove, add, edit, upload, reconnecting }: {
  images: DraftImage[]; busy: boolean; remove: (id: string) => void; add: () => void;
  edit: (id: string) => void; upload?: UploadProgress; reconnecting?: boolean;
}) {
  useLanguage();
  return <DraftImagePreviews images={images} limit={MAX_CHAT_IMAGES} disabled={busy} translate={t} add={add}
    edit={index => edit(images[index].id)} remove={index => remove(images[index].id)}
    progress={upload && (index => <ChatUploadProgress progress={itemUploadProgress(upload, 'image', index)}
      reconnecting={reconnecting} />)} />;
}
