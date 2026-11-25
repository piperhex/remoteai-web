import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { MonitorSmartphone, PanelBottom, PanelRight, ExternalLink, X } from 'lucide-react';
import type { MarketKey, MarketText } from '../../provider-market/i18n';
import { useInspector, type InspectorSurface } from './useInspector';
import type { InspectorDock } from './inspectorSession';
import { DeviceToolbar } from './DeviceToolbar';
import { initialDevice, responsiveDevice, type ViewportSize } from './deviceViewport';
import { ViewportHandles } from './ViewportHandles';
import './browserInspector.css';

const MIN_SHARE = 20;
const MAX_SHARE = 80;
const INITIAL_SHARE = 40;
const KEYBOARD_STEP = 2;
const clampShare = (value: number) => Math.max(MIN_SHARE, Math.min(MAX_SHARE, value));

/** The actual inspector stays native; this shared shell owns its placement and accessible splitter. */
export function BrowserInspector(props: InspectorSurface & { t: MarketText; children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<ViewportSize>({ width: 0, height: 0 });
  const [device, setDevice] = useState(initialDevice);
  const [scaleLimit, setScaleLimit] = useState(1);
  const scale = Math.min(scaleLimit, available.width / device.width, available.height / device.height);
  const viewport = useMemo(() => scale > 0 ? { ...device, scale } : undefined, [device, scale]);
  const inspector = useInspector(props, device.name, viewport);
  const { open, dock, setDock, close, failed, host } = inspector;
  const mobile = open && inspector.mobile;
  const responsive = mobile && device.name === responsiveDevice;
  useLayoutEffect(() => {
    if (!mobile || !stage.current) return;
    const observer = new ResizeObserver(([{ contentRect: { width, height } }]) => setAvailable({ width, height }));
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, [mobile]);
  const layout = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState({ right: INITIAL_SHARE, bottom: INITIAL_SHARE });
  const [dragging, setDragging] = useState(false);
  const embedded = open && dock !== 'window';
  const share = dock === 'window' ? 0 : sizes[dock];
  const resize = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || dock === 'window' || !layout.current) return;
    const bounds = layout.current.getBoundingClientRect();
    const value = dock === 'right' ? (bounds.right - event.clientX) / bounds.width
      : (bounds.bottom - event.clientY) / bounds.height;
    setSizes(current => ({ ...current, [dock]: clampShare(value * 100) }));
  };
  const endDrag = () => setDragging(false);
  const options: { dock: InspectorDock; icon: typeof PanelRight; key: MarketKey }[] = [
    { dock: 'right', icon: PanelRight, key: 'market.inspectorRight' },
    { dock: 'bottom', icon: PanelBottom, key: 'market.inspectorBottom' },
    { dock: 'window', icon: ExternalLink, key: 'market.inspectorWindow' },
  ];
  return <div ref={layout} className="browser-inspector-layout" data-dock={open ? dock : 'closed'}>
    <div className={mobile ? 'browser-inspector-phone' : 'browser-inspector-page'}>
      {mobile && <DeviceToolbar device={device} change={next => { setScaleLimit(1); setDevice(next); }}
        scale={scale} t={props.t} />}
      <div key="stage" ref={stage} className="browser-device-stage" data-responsive={responsive || undefined}
        style={mobile && viewport ? {
        '--device-preview-width': `${viewport.width * scale}px`,
        '--device-preview-height': `${viewport.height * scale}px`,
      } as CSSProperties : undefined}>
        {props.children}
        {responsive && <ViewportHandles size={device} scale={scale} t={props.t}
          resize={(size, startScale) => {
            setScaleLimit(startScale); setDevice({ ...size, name: responsiveDevice });
          }} />}
      </div>
    </div>
    {embedded && <div className="browser-inspector-splitter" role="separator" tabIndex={0}
      aria-label={props.t('market.inspectorResize')} aria-orientation={dock === 'right' ? 'vertical' : 'horizontal'}
      aria-valuemin={MIN_SHARE} aria-valuemax={MAX_SHARE} aria-valuenow={Math.round(share)}
      onPointerDown={event => { if (event.button !== 0) return; event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }}
      onPointerMove={resize} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
      onDoubleClick={() => setSizes(current => ({ ...current, [dock]: INITIAL_SHARE }))}
      onKeyDown={event => {
        const decrease = dock === 'right' ? 'ArrowRight' : 'ArrowDown';
        const increase = dock === 'right' ? 'ArrowLeft' : 'ArrowUp';
        if (![decrease, increase, 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? MIN_SHARE : event.key === 'End' ? MAX_SHARE
          : share + (event.key === increase ? KEYBOARD_STEP : -KEYBOARD_STEP);
        setSizes(current => ({ ...current, [dock]: clampShare(next) }));
      }} />}
    {open && <section className="browser-inspector-panel" aria-label={props.t('market.inspectorTitle')}
      style={embedded ? { flexBasis: `${share}%` } : undefined}>
      <div className="browser-inspector-toolbar">
        <button type="button" title={props.t('market.inspectorMobile')} aria-label={props.t('market.inspectorMobile')}
          aria-pressed={inspector.mobile} disabled={inspector.switching} onClick={inspector.toggleMobile}>
          <MonitorSmartphone size="1.2em" aria-hidden="true" />
        </button>
        <div role="group" aria-label={props.t('market.inspectorPlacement')}>
          {options.map(option => <button key={option.dock} type="button" title={props.t(option.key)}
            aria-label={props.t(option.key)} aria-pressed={dock === option.dock}
            onClick={() => setDock(option.dock)}><option.icon size="1.2em" /></button>)}
          <button type="button" aria-label={props.t('market.close')} title={props.t('market.close')}
            onClick={close}><X size="1.2em" /></button>
        </div>
      </div>
      {inspector.deviceFailed && <p className="browser-inspector-device-error" role="status">
        {props.t('market.inspectorDeviceFailed')}</p>}
      <div ref={host} className="browser-inspector-native">
        {failed && <p role="status">{props.t('market.inspectorFailed')}</p>}
      </div>
    </section>}
  </div>;
}
