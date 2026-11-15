import { useLayoutEffect, useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import { ComposerInput } from '../remote-chat/views/ComposerInput';
import { ComposerContextMenu } from '../chat/ComposerContextMenu';
import { uiText } from '../localization/uiText';
import { useGuiFontSize } from '../appearance/fontSize';
import { useComposerAutoFocus } from '../chat/useComposerAutoFocus';

function resize(input: HTMLTextAreaElement | null) {
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = `${input.scrollHeight}px`;
}

export function CliComposerInput({ value, scope, active, disabled, canSend, onChange, onSend, remote, className,
  onPaste, onPasteKeyDown }: {
  value: string; scope: string; active: boolean; disabled: boolean; canSend: boolean; remote: boolean;
  className?: string; onChange: (text: string) => void; onSend: () => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onPasteKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  useComposerAutoFocus({ input, active, disabled });
  const fontSize = useGuiFontSize();
  useLayoutEffect(() => { resize(input.current); }, [value, scope, active, fontSize]);
  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth; resize(element);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [scope]);
  const props = { value, disabled, onPaste, rows: 1, 'aria-label': uiText('client.cliGui.message'),
    placeholder: uiText('client.cliGui.messageHint'),
    onChange: (event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value),
    onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229) return;
      onPasteKeyDown(event);
      if (event.key === 'Enter' && !event.shiftKey && !event.altKey && canSend) {
        event.preventDefault(); onSend();
      }
    } };
  if (remote) return <div className="chat-composer-field"><div className="chat-composer-content">
    <ComposerInput {...props} ref={input} contextScope={scope} active={active} />
  </div></div>;
  return <ComposerContextMenu scope={scope} active={active} translate={uiText}>
    <textarea {...props} ref={input} className={`cli-gui-input ${className ?? ''}`} />
  </ComposerContextMenu>;
}
