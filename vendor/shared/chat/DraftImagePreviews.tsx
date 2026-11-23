import { Plus, X } from 'lucide-react';
import type { Key, ReactNode } from 'react';
import type { MessageTranslator } from '../localization/messages';
import './draftImagePreviews.css';

interface DraftImagePreviewsProps {
  images: { id: Key; url: string }[];
  limit: number;
  disabled: boolean;
  translate: MessageTranslator;
  add: () => void;
  edit: (index: number) => void;
  remove: (index: number) => void;
  progress?: (index: number) => ReactNode;
  className?: string;
}

export function DraftImagePreviews({ images, limit, disabled, translate: t, add, edit, remove,
  progress, className = '' }: DraftImagePreviewsProps) {
  if (!images.length) return null;
  return <div className={`chat-attachment-previews ${className}`}>
    {images.map((image, index) => <div key={image.id}
      className={`chat-attachment-preview${progress ? ' is-uploading' : ''}`}>
      <img src={image.url} alt={t('client.chat.attachedImage', { value1: index + 1 })} />
      {progress?.(index)}
      <button type="button" className="chat-attachment-edit" disabled={disabled}
        aria-label={t('client.chat.annotateImage', { value1: index + 1 })}
        onClick={() => edit(index)}>{t('client.chat.annotate')}</button>
      <button type="button" className="chat-attachment-remove" disabled={disabled}
        aria-label={t('client.chat.removeImage', { value1: index + 1 })}
        onClick={() => remove(index)}><X size={16} /></button>
    </div>)}
    {images.length < limit && <button type="button" className="chat-attachment-more"
      aria-label={t('client.chat.addMoreImages')} disabled={disabled} onClick={add}><Plus size={24} /></button>}
  </div>;
}
