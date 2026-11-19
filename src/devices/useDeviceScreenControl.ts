import { Toast } from 'antd-mobile';
import { useCallback } from 'react';
import { useDeviceScreenControl as useScreenControl } from '../../../../shared/remote-desktop/useDeviceScreenControl';
import { readScreenPower } from '../../../../shared/remote-desktop/screenControl';
import { apiJson } from '../api';
import { t } from '../../../../shared/localization/browserClient';
import { useAppSelector } from '../hooks';

export function useDeviceScreenControl() {
  const session = useAppSelector(state => state.auth.session);
  const scope = JSON.stringify([session?.baseUrl, session?.email]);
  // Changing accounts invalidates any display reading from the previous account.
  const read = useCallback((deviceId: string, signal: AbortSignal) => readScreenPower(apiJson, deviceId, signal), [scope]);
  const change = useScreenControl({
    scope,
    request: apiJson,
    notify: message => { Toast.show({ content: t(message), position: 'top' }); },
  });
  return { change, read };
}
