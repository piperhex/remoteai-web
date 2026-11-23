import { DraftImagePreviews } from '../chat/DraftImagePreviews';
import { ImageEditor } from '../chat/ImageEditor';
import { displayText as t } from '../localization/messages';
import { getInterfaceLanguage } from '../localization/interfaceLanguage';
import { LOUNGE_IMAGE_EDITOR_LIMITS, useLoungeImageEditor,
  type LoungeImageAttachmentsProps } from './useLoungeImageEditor';
import { MAX_IMAGES } from './types';

export function LoungeImageAttachments(props: LoungeImageAttachmentsProps & { onAdd: () => void }) {
  const { images, setImages, disabled } = props;
  const editor = useLoungeImageEditor(props);
  return <>
    <DraftImagePreviews className="lounge-attachments" images={images.map((url, id) => ({ id, url }))}
      limit={MAX_IMAGES} disabled={disabled} translate={t} add={props.onAdd} edit={editor.open}
      remove={index => setImages(value => value.filter((_, position) => position !== index))} />
    {editor.editing && <ImageEditor dataUrl={editor.editing.original} mode="direct"
      outputLimits={{ ...LOUNGE_IMAGE_EDITOR_LIMITS, targetBytes: props.maxBytes ?? LOUNGE_IMAGE_EDITOR_LIMITS.targetBytes }}
      language={getInterfaceLanguage()} translate={t}
      save={editor.save} close={editor.close} />}
  </>;
}
