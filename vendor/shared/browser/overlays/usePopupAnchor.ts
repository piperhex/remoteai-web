import { useLayoutEffect, useState, type RefObject, type CSSProperties } from 'react';
import { theme } from 'antd';

/** A full-client native popup uses the same CSS coordinates as its owning document. */
export function usePopupAnchor(anchor: RefObject<HTMLElement>, enabled: boolean, align: 'stretch' | 'end' = 'stretch'):
  CSSProperties | undefined {
  const [bounds, setBounds] = useState<DOMRect>();
  const { token } = theme.useToken();
  useLayoutEffect(() => {
    if (!enabled || !anchor.current) return;
    const element = anchor.current.closest('form') ?? anchor.current;
    const sync = () => setBounds(element.getBoundingClientRect());
    const observer = new ResizeObserver(sync); observer.observe(element);
    window.addEventListener('resize', sync); window.addEventListener('scroll', sync, true); sync();
    return () => { observer.disconnect(); window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true); };
  }, [anchor, enabled]);
  return enabled && bounds ? { position: 'fixed', top: bounds.bottom + 5,
    ...(align === 'end' ? { right: window.innerWidth - bounds.right, width: 'max-content' }
      : { left: bounds.left, right: 'auto', width: bounds.width }),
    zIndex: 1700, fontSize: token.fontSize, fontFamily: token.fontFamily,
    '--panel-bg': token.colorBgElevated, '--text': token.colorText, '--border': token.colorBorderSecondary,
    '--text-secondary': token.colorTextSecondary, '--hover-bg': token.colorBgTextHover,
    '--accent': token.colorPrimary } as CSSProperties & Record<`--${string}`, string> : undefined;
}
