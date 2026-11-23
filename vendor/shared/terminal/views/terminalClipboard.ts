import type { Terminal } from '@xterm/xterm';
import { uiText } from '../../localization/uiText';

export function bindTerminalClipboard(host: HTMLElement, terminal: Terminal, report: (message: string) => void) {
  const canPaste = () => !terminal.options.disableStdin && terminal.textarea === document.activeElement;

  async function paste() {
    if (!canPaste()) return;
    try {
      const text = await navigator.clipboard.readText();
      // The user may switch tabs or close the shell while the browser asks for permission.
      if (text && canPaste()) terminal.paste(text);
    } catch {
      if (canPaste()) report(uiText('client.chat.couldNotPasteTryAgain'));
    }
  }

  async function copySelection() {
    try {
      await navigator.clipboard.writeText(terminal.getSelection());
    } catch {
      report(uiText('client.chat.couldNotCopyTryAgain'));
    }
  }

  function rightClick(event: MouseEvent) {
    if (event.button !== 2 || ('pointerType' in event && event.pointerType === 'touch')) return;
    event.preventDefault();
    if (terminal.modes.mouseTrackingMode !== 'none') return;
    // xterm otherwise moves its hidden textarea under the pointer for the native context menu.
    event.stopPropagation();
    terminal.focus();
    void paste();
  }

  terminal.attachCustomKeyEventHandler(event => {
    if (event.type !== 'keydown' || !(event.ctrlKey || event.metaKey)) return true;
    if (event.key.toLowerCase() === 'c' && terminal.hasSelection()) {
      event.preventDefault();
      void copySelection();
      return false;
    }
    if (event.key.toLowerCase() === 'v' && event.shiftKey) {
      event.preventDefault();
      void paste();
      return false;
    }
    return true;
  });

  host.addEventListener('contextmenu', rightClick, true);
  return () => host.removeEventListener('contextmenu', rightClick, true);
}
