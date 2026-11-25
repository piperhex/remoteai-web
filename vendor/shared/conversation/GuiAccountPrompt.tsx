import { Alert, Button } from 'antd';
import { applications } from '@remoteai/i18n';
import { createContext, useRef, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { uiText } from '../localization/uiText';
import { MODEL_CATALOG_ERROR } from '../remote-chat/composer';
import { formatRemoteError } from '../localization/errors';

export const GuiAccountMenuRef = createContext<RefObject<(() => void) | null> | null>(null);

export function useOpenGuiAccountMenu(revealSidebar: () => void) {
  const menu = useRef<(() => void) | null>(null);
  function open() {
    // A collapsed sidebar may unmount the picker. Mount it before opening its popover.
    flushSync(revealSidebar);
    menu.current?.();
  }
  return { menu, open };
}

export function GuiAccountNotice({ className }: { className?: string }) {
  return <Alert className={className} role="status" type="info" showIcon
    message={uiText('client.remoteHostMessages.chooseAnAvailableAccount')} />;
}

export function ChooseGuiAccount({ onClick }: { onClick: () => void }) {
  return <Button type="text" size="small" htmlType="button" onClick={onClick}>
    {uiText('client.chat.chooseAccount')}
  </Button>;
}

// Host and client can use different languages. Older hosts send the rendered catalog error.
const catalogNoticeKeys = [MODEL_CATALOG_ERROR, 'client.conversation.modelsAreSyncingPleaseTryAgainShortly'] as const;
const catalogNotices = new Set(catalogNoticeKeys.flatMap(key =>
  applications.desktop.map(language => uiText(key, {}, language))));

export function visibleAccountError(error: string, accountRequired: boolean) {
  return error && accountRequired && catalogNotices.has(formatRemoteError('en', error)) ? '' : error;
}
