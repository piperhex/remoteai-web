import { useEffect, useSyncExternalStore } from 'react';
import { ChevronDown, ChevronUp, GripHorizontal, Mouse } from 'lucide-react';
import type { DesktopPointer } from '../input';
import { cursorPosition, mousePanelPosition, MOUSE_PANEL_SIZE, MOUSE_ICON_SIZE, MOUSE_SIZE, CURSOR_SIZE,
  type DesktopViewport }
  from '../geometry';
import type { MousePanelActivity } from '../useMousePanel';
import cursorImage from '../cursor.svg';
import { t } from '../../localization/browserClient';
import { useMouseButtons } from './useMouseButtons';
import { useTrackpad } from './useTrackpad';
import { useScrollPad, type ScrollPadGesture } from '../useScrollPad';
import type { DesktopWheel } from '../scrollPad';
import { useScrollButton } from './useScrollButton';
import { DesktopScrollPad } from './DesktopScrollPad';

interface Props {
  pointer: DesktopPointer; viewport: DesktopViewport; panel: MousePanelActivity;
  wheel: DesktopWheel; horizontal: boolean; contained?: boolean;
}
type MousePadProps = Omit<Props, 'wheel' | 'horizontal'> & { scroll: ScrollPadGesture };
export function DesktopMouse({ visible, ...props }: Props & { visible: boolean }) {
  const position = useSyncExternalStore(props.pointer.subscribe, props.pointer.getSnapshot);
  const scroll = useScrollPad({ ...props, enabled: visible && props.panel.expanded });
  const cursor = cursorPosition(position, props.viewport);
  const panelSize = props.panel.expanded ? MOUSE_PANEL_SIZE : MOUSE_ICON_SIZE;
  const panel = mousePanelPosition(cursor, props.contained ? { stage: props.viewport.stage, panel: panelSize } : undefined);
  return <>
    {props.panel.expanded && <img className="rd-cursor" src={cursorImage} alt="" aria-hidden="true" draggable={false}
      style={{ ...CURSOR_SIZE, left: cursor.x, top: cursor.y }} />}
    {visible && <div className="rd-mouse-layer" aria-hidden={scroll.active || undefined}
      style={{ ...panelSize, left: panel.x, top: panel.y, opacity: scroll.active ? 0 : 1 }}>
      {props.panel.expanded ? <MousePad {...props} scroll={scroll} /> : <MouseIcon {...props} />}
    </div>}
    {visible && scroll.active && <DesktopScrollPad layout={scroll.layout} position={scroll.position}
      horizontal={props.horizontal} cancel={scroll.end} />}
  </>;
}

function MouseIcon({ pointer, viewport, panel }: Props) {
  const drag = useTrackpad({ pointer, viewport, panel, id: 'icon', onTap: panel.expand });
  return <button className="rd-mouse-icon" aria-label={t("client.remoteDesktop.expandMouseControls")} {...drag}
    onClick={event => { if (event.detail === 0) panel.expand(); }}><Mouse /></button>;
}

function MousePad({ pointer, viewport, panel, scroll, contained }: MousePadProps) {
  const buttons = useMouseButtons(pointer, viewport, panel, contained);
  const leftLabel = buttons.dragging && !contained ? 'client.remoteDesktop.dragging' : 'client.remoteDesktop.left';
  const padLabel = buttons.dragging && contained ? 'client.remoteDesktop.dragging' : 'client.remoteDesktop.swipeToMove';
  const wheel = useScrollButton(scroll);
  const pad = useTrackpad({ pointer, viewport, panel, id: 'pad', cancel: buttons.cancel });
  const grip = useTrackpad({ pointer, viewport, panel, id: 'grip', click: false, cancel: buttons.cancel });
  useEffect(() => { panel.hold('drag', buttons.dragging); return () => panel.hold('drag', false); },
    [buttons.dragging, panel.hold]);
  return <div className="rd-mouse" style={MOUSE_SIZE}>
    <div className="rd-mouse-top">{(['left', 'right'] as const).map(button =>
      <button key={button} aria-label={t(button === 'left' ? "client.remoteDesktop.leftMouseButton" : "client.remoteDesktop.rightMouseButton")}
        aria-pressed={button === 'left' && buttons.dragging}
        {...buttons.handlers(button)}>
        {t(button === 'left' ? leftLabel : 'client.remoteDesktop.right')}</button>)}</div>
    <div className="rd-pad" {...pad}>{t(padLabel)}</div>
    <button className="rd-wheel" aria-label={t("client.remoteDesktop.holdAndDragToScroll")} {...wheel}>
      <ChevronUp size={18} /><ChevronDown size={18} /></button>
    <button className="rd-grip" aria-label={t("client.remoteDesktop.moveMousePanel")} {...grip}><GripHorizontal size={22} /></button>
  </div>;
}
