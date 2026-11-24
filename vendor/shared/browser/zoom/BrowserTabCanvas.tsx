import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { isTauri } from '@tauri-apps/api/core';
import type { Language } from '@remoteai/i18n';
import { Minus, Plus, ZoomIn } from 'lucide-react';
import { uiText } from '../../localization/uiText';
import { useBrowserOverlay } from '../overlays/BrowserOverlayProvider';
import { usePopupAnchor } from '../overlays/usePopupAnchor';
import { NativeZoomContext } from './nativeZoom';
import { useTabZoom } from './useTabZoom';
import { defaultZoom, zoomLevels } from './zoomLevel';
import { bindZoomWheel, watchZoomWheel } from './zoomWheel';
import './browserZoom.css';

export function BrowserTabCanvas({ id, anchor, language, desktop, manager, covered, children }: {
  id: string; anchor: HTMLElement | null; language: Language; desktop: boolean;
  manager: boolean; covered: boolean; children: ReactNode;
}) {
  const canvas = useRef<HTMLDivElement | null>(null);
  const zoom = useTabZoom(id, Boolean(anchor));
  const trigger = useRef<HTMLButtonElement>(null);
  const overlay = useBrowserOverlay();
  const popupRef = useRef<HTMLDivElement>(null);
  const placement = usePopupAnchor(trigger, Boolean(overlay && zoom.visible), 'end');
  useEffect(() => {
    if (popupRef.current) return bindZoomWheel(popupRef.current, zoom.step);
  }, [zoom.visible, overlay, zoom.step]);
  useEffect(() => {
    const toolbar = anchor?.closest<HTMLElement>('.pm-browser-toolbar');
    if (canvas.current && toolbar) return watchZoomWheel(canvas.current, toolbar, zoom.step);
  }, [anchor, zoom.step]);
  const label = (key: Parameters<typeof uiText>[0]) => uiText(key, {}, language);
  const scaled = desktop && !zoom.kind && zoom.percent !== defaultZoom;
  const popup = zoom.visible && <div ref={popupRef} data-browser-popup className="browser-zoom-popup" role="group"
    aria-label={label('client.shared.zoomLevel')} data-native-fallback={!overlay && isTauri() || undefined}
    style={placement}>
    <output aria-live="polite">{zoom.percent}%</output>
    <button type="button" disabled={zoom.percent <= zoomLevels[0]} aria-label={label('client.filePreview.pdfZoomOut')}
      onClick={() => zoom.step(-1)}><Minus size="1.15em" /></button>
    <button type="button" disabled={zoom.percent >= zoomLevels[zoomLevels.length - 1]}
      aria-label={label('client.filePreview.pdfZoomIn')} onClick={() => zoom.step(1)}><Plus size="1.15em" /></button>
    <button type="button" className="browser-zoom-reset" disabled={zoom.percent === defaultZoom}
      onClick={() => zoom.step(0)}>{label('client.shared.reset')}</button>
  </div>;
  return <>
    <div className={`browser-tab-canvas${covered ? ' browser-home-covered' : ''}`}
      ref={element => { canvas.current = element; if (element) element.inert = manager || covered; }}
      aria-hidden={manager || covered || undefined} data-page-zoom={scaled || undefined}
      style={scaled ? { '--browser-page-scale': zoom.percent / defaultZoom } as CSSProperties : undefined}>
      <NativeZoomContext.Provider value={zoom}>{children}</NativeZoomContext.Provider>
    </div>
    {anchor && createPortal(<button type="button" ref={trigger} aria-label={label('client.shared.zoomLevel')}
      aria-expanded={zoom.visible} title={label('client.shared.zoomLevel')} onClick={zoom.show}>
      <ZoomIn size={15} /></button>, anchor)}
    {popup && anchor && createPortal(popup, overlay ?? anchor)}
  </>;
}
