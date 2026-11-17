const SHADOW_MARGIN = 14;
// Ant Design portals nested menus beside the root dropdown, with their own popup classes.
const POPUPS = '.ant-popover,.ant-dropdown,.ant-dropdown-menu-submenu-popup,.ant-menu-submenu-popup,'
  + '.ant-select-dropdown,.ant-tooltip,.ant-modal-wrap,'
  + '.ant-modal-mask,.ant-drawer-mask,.ant-drawer-content-wrapper,[data-browser-popup]';

/** The portal document does not scroll. Use layout coordinates, never animated transform bounds:
 * rc-motion briefly scales a menu to zero, then grows it without DOM mutations between frames.
 * Clipping the native window to those intermediate bounds cuts off icons until animationend.
 */
function layoutBounds(element: HTMLElement) {
  let left = element.offsetLeft, top = element.offsetTop;
  for (let parent = element.offsetParent as HTMLElement | null; parent;
    parent = parent.offsetParent as HTMLElement | null) {
    left += parent.offsetLeft + parent.clientLeft - parent.scrollLeft;
    top += parent.offsetTop + parent.clientTop - parent.scrollTop;
  }
  return { left, top, width: element.offsetWidth, height: element.offsetHeight };
}

export function popupRegions(popup: Window) {
  return [...popup.document.querySelectorAll<HTMLElement>(POPUPS)].flatMap(element => {
    const style = popup.getComputedStyle(element), rect = layoutBounds(element);
    if (style.display === 'none' || style.visibility === 'hidden' || !rect.width || !rect.height) return [];
    const x = Math.max(0, rect.left - SHADOW_MARGIN), y = Math.max(0, rect.top - SHADOW_MARGIN);
    const right = Math.min(popup.innerWidth, rect.left + rect.width + SHADOW_MARGIN);
    const bottom = Math.min(popup.innerHeight, rect.top + rect.height + SHADOW_MARGIN);
    // rc-trigger measures newly mounted menus far outside the viewport before aligning them.
    return right > x && bottom > y ? [{ x, y, width: right - x, height: bottom - y }] : [];
  }).slice(0, 128);
}
