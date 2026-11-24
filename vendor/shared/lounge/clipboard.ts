import { copyText } from '../clipboard';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { copyBrowserImage } from '../clipboardImage';
import type { LoungeMessage } from './types';

/** Text takes precedence in mixed messages; image-only messages copy the first attached image. */
export async function copyLoungeMessage(message: LoungeMessage) {
  if (message.text) return copyText(message.text);
  return copyLoungeImage(message.images[0]);
}

/** Copy the original preview on the viewing device, also when connected to a remote desktop. */
export async function copyLoungeImage(image: string): Promise<void> {
  if (!image) throw new Error('clipboard-image-unavailable');
  if (isTauri()) {
    const result = await invoke<{ completed: boolean }>('codex_gui_image_action', {
      request: { source: image, action: 'copy' },
    });
    if (!result.completed) throw new Error('clipboard-image-unavailable');
    return;
  }
  await copyBrowserImage(image);
}
