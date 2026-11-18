import { t, useLanguage } from '../../localization/browserClient';
import { DeferredDetails } from '../../chat/DeferredDetails';
import { memo } from 'react';
import { Pencil, Quote } from 'lucide-react';
import type { Item } from './types';
import { itemImageSources } from '../../chat/imageSources';
import { quotedMessage } from '../../chat/quotedMessage';
import { questionMessageText } from '../client/asyncQuestions';
import { ChatActivity } from './ChatActivity';
import { ChatMarkdown } from './ChatMarkdown';
import { ChatImage } from './ChatImage';
import { ChatCopyButton } from './ChatCopyButton';
import { ChatQuoteButton } from './ChatQuotes';
import { messageReferences } from '../../chat/messageReferences';
import { ChatMessageReferences } from './ChatMessageReferences';
import { messageAttachments } from '../../chat/messageAttachments';
import { MessageAttachments } from '../../chat/SentMessageAttachments';
import { ChatFileLink } from './ChatFileLink';

export const ChatMessage = memo(function ChatMessage({ item, onOpen, process = false, running = false, onQuote,
  desktop = false, onInspect, onEdit, editDisabled }: {
  item: Item; onOpen: (id: string) => void; process?: boolean; running?: boolean; onQuote?: () => void;
  desktop?: boolean; onInspect?: () => void; onEdit?: () => void; editDisabled?: boolean;
}) {
  useLanguage();
  const text = questionMessageText(item);
  if (!['userMessage', 'agentMessage'].includes(item.type)) {
    return <ChatActivity item={item} onOpen={onOpen} running={running && item.status === 'inProgress'}
      inline={desktop} onInspect={onInspect} />;
  }
  const user = item.type === 'userMessage';
  const content = quotedMessage(text);
  const images = itemImageSources(item);
  const references = messageReferences(item);
  const files = messageAttachments(user ? content.text : '', references);
  return <article className={user ? 'chat-user-message-wrap' : 'chat-assistant-message'}
    data-quote-source={desktop && !user ? item.id : undefined}>
    {user && desktop && images.length > 0 && <div className="chat-sent-images">
      {images.map((source, index) => <ChatImage key={index} source={source} />)}
    </div>}
    {user ? (!desktop || content.text || content.quotes.length > 0 || references.length > 0)
      && <div className="chat-user-message">
      <ChatMessageReferences references={files.references} />
      {content.quotes.map((quote, index) => <DeferredDetails className="chat-message-quote" key={index}
        summary={<summary><Quote size={14} /><span>{quote}</span></summary>}>
        {() => <blockquote>{quote}</blockquote>}
      </DeferredDetails>)}
      <MessageAttachments key={text} attachments={files.attachments} t={t}
        renderFile={file => <ChatFileLink href={file.path}>{file.name}</ChatFileLink>} />
      {files.text && <ChatMarkdown text={files.text} desktop={desktop} />}
      {!desktop && images.length > 0 && <div className="chat-sent-image-previews">
        {images.map((source, index) => <ChatImage key={index} source={source} />)}
      </div>}
    </div> : <ChatMarkdown text={text} process={process} desktop={desktop} streaming={running} />}
    {(!!text.trim() || onEdit) && !running && !(desktop && process)
      && <div className="chat-message-actions" data-quote-exclude>
      <ChatCopyButton text={text} label={user ? t("client.chat.copyMessage") : t("client.chat.copyReply")} iconOnly={!user} />
      {onEdit && <button type="button" className="chat-text-action"
        aria-label={t('client.workspaceActions.editMessage')}
        disabled={editDisabled} onClick={onEdit}><Pencil size={14} /></button>}
      <ChatQuoteButton messageId={item.id} text={text} role={user ? 'user' : 'assistant'} onQuote={onQuote} />
    </div>}
  </article>;
});
