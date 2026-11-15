import { useEffect, useState } from 'react';
import { Alert, Popover } from 'antd';
import { MoreVertical, Pin, PinOff, Puzzle, Settings, X } from 'lucide-react';
import type { MarketText } from '../../provider-market/i18n';
import { ExtensionIcon, ExtensionManager } from './ExtensionManager';
import { useExtensions } from './useExtensions';
import './extensions.css';
import assistantIcon from './assistant.png';
import type { BrowserPanelSelection } from './BrowserSidePanel';

export function BrowserExtensions({ t, active, onOverlay, onPanel, panelId, closePanel }: {
  t: MarketText; active: boolean; onOverlay: (open: boolean) => void;
  onPanel: (panel: BrowserPanelSelection) => void; panelId?: string; closePanel: () => void;
}) {
  const [open, setOpen] = useState(false), [manager, setManager] = useState(false);
  const extensions = useExtensions(active);
  useEffect(() => { onOverlay(open || manager); return () => onOverlay(false); }, [open, manager, onOverlay]);
  useEffect(() => { if (!active) { setOpen(false); setManager(false); } }, [active]);
  useEffect(() => {
    if (panelId && extensions.supported && !extensions.entries.some(entry => entry.id === panelId && entry.enabled)) {
      closePanel();
    }
  }, [extensions.entries, extensions.supported, panelId, closePanel]);
  const showPanel = (panel: BrowserPanelSelection) => { setOpen(false); setManager(false); onPanel(panel); };
  const openExtension = (entry: typeof extensions.entries[number]) => {
    if (entry.sidePanel && entry.enabled) showPanel({ id: entry.id, name: entry.name });
    else if (entry.popup && entry.enabled) void extensions.request({ action: 'open', id: entry.id });
    else manage();
  };
  const manage = () => { setOpen(false); setManager(true); };
  const content = <div className="browser-extensions-menu">
    <div className="browser-extensions-heading"><strong>{t('market.extensionsTitle')}</strong>
      <button aria-label={t('market.close')} onClick={() => setOpen(false)}><X size="1.25em" /></button></div>
    {extensions.error && <Alert type="error" message={t(extensions.error)} />}
    <div className="browser-extension-list">
      <button className="browser-extension-builtin" onClick={() => showPanel({})}>
        <img className="browser-extension-icon" src={assistantIcon} alt="" />
        <span><span>{t('market.extensionsAssistant')}</span><small>{t('market.extensionsBuiltin')}</small></span></button>
      {extensions.entries.map(entry => <div className="browser-extension-row" key={entry.id}>
        <button className="browser-extension-name" onClick={() => openExtension(entry)}>
          <ExtensionIcon icon={entry.icon} /><span><span>{entry.name}</span><small>{t(entry.enabled
          ? 'market.extensionsEnabled' : 'market.extensionsDisabled')}</small></span></button>
        <button disabled={extensions.busy} aria-pressed={entry.pinned}
          aria-label={t(entry.pinned ? 'market.extensionsUnpin' : 'market.extensionsPin') + ': ' + entry.name}
          title={t(entry.pinned ? 'market.extensionsUnpin' : 'market.extensionsPin')}
          onClick={() => void extensions.request({ action: 'pin', id: entry.id, pinned: !entry.pinned })}>
          {entry.pinned ? <Pin size="1.25em" /> : <PinOff size="1.25em" />}</button>
        <button aria-label={t('market.extensionsManage') + ': ' + entry.name} onClick={manage}>
          <MoreVertical size="1.25em" /></button>
      </div>)}
    </div>
    <button className="browser-extensions-manage" onClick={manage}><Settings size="1.25em" />
      {t('market.extensionsManage')}</button>
  </div>;
  return <div className="browser-extensions-toolbar">
    <button aria-label={t('market.extensionsAssistant')} title={t('market.extensionsAssistant')}
      onClick={() => showPanel({})}><img className="browser-extension-icon" src={assistantIcon} alt="" /></button>
    {extensions.entries.filter(entry => entry.pinned && entry.enabled).map(entry =>
      <button key={entry.id} title={entry.name} aria-label={entry.name}
        onClick={() => openExtension(entry)}>
        <ExtensionIcon icon={entry.icon} /></button>)}
    <Popover trigger="click" placement="bottomRight" open={open} content={content}
      overlayClassName="browser-extensions-popover" onOpenChange={value => {
        setOpen(value); if (value) void extensions.request({ action: 'list' });
      }}><button aria-label={t('market.extensionsTitle')} title={t('market.extensionsTitle')}
        aria-expanded={open}><Puzzle size="1.25em" /></button></Popover>
    {manager && <ExtensionManager extensions={extensions} t={t} close={() => setManager(false)} onPanel={showPanel} />}
  </div>;
}
