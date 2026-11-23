import type { Terminal } from '@xterm/xterm';
import { uiText } from '../../localization/uiText';

export function bindTerminalClipboard(host: HTMLElement, terminal: Terminal, report: (message: string) => void) {
  const canPaste = () => !terminal.options.disableStdin && terminal.textarea === document.activeElement;

  async function paste() {
    if (!canPaste()) return;
    report('');
    try {
      const text = await navigator.clipboard.readText();
      // The user may switch tabs or close the shell while the browser asks for permission.
      if (text && canPaste()) terminal.paste(text);
    } catch {
      if (canPaste()) report(uiText('client.chat.couldNotPasteTryAgain'));
    }
  }

  function preserveSelection(event: MouseEvent) {
    // A mouse-aware application would otherwise receive the button before the contextmenu event.
    if (event.button === 2 && terminal.hasSelection()) event.stopPropagation();
  }

  function rightClick(event: MouseEvent) {
    if (event.button !== 2 || ('pointerType' in event && event.pointerType === 'touch')) return;
    event.preventDefault();
    const selected = terminal.hasSelection();
    if (!selected && terminal.modes.mouseTrackingMode !== 'none') return;
    // xterm otherwise moves its hidden textarea under the pointer for the native context menu.
    event.stopPropagation();
    terminal.focus();
    if (selected) void copySelection(terminal, report, true);
    else void paste();
  }

  terminal.attachCustomKeyEventHandler(event => {
    if (event.type !== 'keydown' || !(event.ctrlKey || event.metaKey)) return true;
    if (event.key.toLowerCase() === 'c' && terminal.hasSelection()) {
      event.preventDefault();
      void copySelection(terminal, report);
      return false;
    }
    if (event.key.toLowerCase() === 'v' && event.shiftKey) {
      event.preventDefault();
      void paste();
      return false;
    }
    return true;
  });

  host.addEventListener('mousedown', preserveSelection, true);
  host.addEventListener('contextmenu', rightClick, true);
  return () => {
    host.removeEventListener('mousedown', preserveSelection, true);
    host.removeEventListener('contextmenu', rightClick, true);
  };
}

async function copySelection(terminal: Terminal, report: (message: string) => void, clearAfterCopy = false) {
  const original = clearAfterCopy ? terminal.getSelectionPosition() : undefined;
  report('');
  try {
    await navigator.clipboard.writeText(terminal.getSelection());
  } catch {
    if (terminal.element?.isConnected) report(uiText('client.chat.couldNotCopyTryAgain'));
    return;
  }
  if (!original || !terminal.element?.isConnected) return;
  const current = terminal.getSelectionPosition();
  if (current && current.start.x === original.start.x && current.start.y === original.start.y
    && current.end.x === original.end.x && current.end.y === original.end.y) terminal.clearSelection();
}
