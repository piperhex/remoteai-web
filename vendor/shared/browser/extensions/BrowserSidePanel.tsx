import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, RotateCw, Settings, X } from 'lucide-react';
import { theme } from 'antd';
import type { MarketText } from '../../provider-market/i18n';
import { openWebsiteInBrowser } from '../../conversation/WebsiteLinkMenu';
import { AssistantSettings } from './AssistantSettings';
import { PanelSurface } from './PanelSurface';
import { usePanelTransport } from './usePanelTransport';
import assistantIcon from './assistant.png';
import './sidePanel.css';

export interface BrowserPanelSelection { id?: string; name?: string; settings?: boolean }

export function BrowserSidePanel({ selection, active, t, close }: {
  selection: BrowserPanelSelection; active: boolean; t: MarketText; close: () => void;
}) {
  const { token } = theme.useToken();
  const [settings, setSettings] = useState(Boolean(selection.settings));
  useEffect(() => { setSettings(Boolean(selection.settings)); }, [selection]);
  const transport = usePanelTransport(selection.id);
  const title = selection.name ?? t('market.extensionsAssistant');
  return <aside className="browser-side-panel" aria-label={t('market.assistantSidePanel')}
    style={{ fontSize: token.fontSize }}>
    <header>
      {!selection.id && <img src={assistantIcon} alt="" />}
      <strong>{settings ? t('market.assistantSettings') : title}</strong>
      {!settings && <button aria-label={t('market.assistantReload')} title={t('market.assistantReload')}
        disabled={!transport.ready} onClick={() => transport.send({ action: 'reload' })}><RotateCw size="1.15em" /></button>}
      {!selection.id && !settings && <button aria-label={t('market.assistantOpenWeb')} title={t('market.assistantOpenWeb')}
        onClick={() => void openWebsiteInBrowser('https://codex.onepiper.cloud/web/')}><ExternalLink size="1.15em" /></button>}
      {!selection.id && <button aria-label={t(settings ? 'market.assistantBackToChat' : 'market.assistantSettings')}
        title={t(settings ? 'market.assistantBackToChat' : 'market.assistantSettings')}
        aria-pressed={settings} onClick={() => setSettings(value => !value)}>
        {settings ? <ArrowLeft size="1.15em" /> : <Settings size="1.15em" />}</button>}
      <button aria-label={t('market.assistantClosePanel')} title={t('market.assistantClosePanel')} onClick={close}>
        <X size="1.15em" /></button>
    </header>
    <div className="browser-side-panel-document" hidden={settings}>
      <PanelSurface transport={transport} active={active && !settings} title={title} t={t} />
    </div>
    {settings && <AssistantSettings t={t} />}
  </aside>;
}
