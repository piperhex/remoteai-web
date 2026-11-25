import { t, useLanguage } from '../../localization/browserClient';
import { AdaptiveSheet } from '../../layout/AdaptiveSheet';
import type { ChatComputer } from '../devices';
import { useState } from 'react';
import { ComputerSearchBar, type ComputerListRefresh } from '../ComputerSearchBar';
import { useDesktopLayout } from '../../layout/useDesktopLayout';
import { useChatSurfaceTheme } from './useChatSurfaceTheme';

export function ChatDevices({ devices, choose, chooseLocal, localDeviceId, onClose, refresh }: {
  devices: ChatComputer[]; choose: (id: string) => void; onClose: () => void; chooseLocal?: () => void;
  refresh?: ComputerListRefresh; localDeviceId?: string;
}) {
  useLanguage();
  const surfaceTheme = useChatSurfaceTheme();
  const desktop = useDesktopLayout();
  const [query, setQuery] = useState('');
  const keyword = desktop ? query.trim().toLocaleLowerCase() : '';
  const matches = devices.filter(device => device.name.toLocaleLowerCase().includes(keyword));
  const showLocal = chooseLocal && t("client.composer.thisComputer").toLocaleLowerCase().includes(keyword);
  return <AdaptiveSheet open title={t("client.settings.chooseAComputer")} width={400} onClose={onClose}
    className="chat-device-picker" style={surfaceTheme}>
    <div className="chat-settings">
      {showLocal && <button type="button" className="chat-setting-entry" onClick={chooseLocal}>
        <strong>{t("client.composer.thisComputer")}</strong></button>}
      {matches.map((device) => <button type="button" key={device.deviceId} className="chat-setting-entry"
        disabled={!device.online} onClick={() => choose(device.deviceId)}>
        <strong>{device.name}</strong><span>{device.deviceId === localDeviceId
          ? t("client.composer.thisComputer") : t(device.online ? "client.chat.online" : "client.chat.offline")}</span>
      </button>)}
      {!devices.length && <p className="chat-muted">{t("client.chat.openRemoteAiOnYourComputerAndSignInWith")}</p>}
      {!!keyword && !showLocal && !matches.length
        && <p className="chat-muted">{t("client.workspaceSettings.noMatchingComputers")}</p>}
      {desktop && refresh?.error && <p className="chat-error" role="alert">{refresh.error}</p>}
      {desktop && <ComputerSearchBar query={query} onQueryChange={setQuery}
        searchLabel={t("client.workspaceSettings.searchComputers")} refreshLabel={t("client.workspaceSettings.refreshComputerList")} refresh={refresh} />}
    </div>
  </AdaptiveSheet>;
}
