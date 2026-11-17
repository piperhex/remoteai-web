/** Keep a same-origin portal document visually identical to its application owner. */
export function preparePopupDocument(popup: Window) {
  const target = popup.document;
  const base = target.createElement('base'); base.href = document.baseURI;
  const rules = target.createElement('style');
  rules.textContent = 'html,body{background:transparent!important;margin:0!important;overflow:hidden!important}'
    + 'body{min-width:0!important}';
  target.head.replaceChildren(base, rules);
  target.body.replaceChildren();
  // rc-trigger and React's input helpers use owner-realm instanceof checks. Create portal nodes
  // in the React owner's realm; appendChild adopts them into the popup without changing prototypes.
  target.createElement = document.createElement.bind(document);
  target.createElementNS = document.createElementNS.bind(document);
  const copies = new Map<Element, Element>();
  const sync = () => {
    const styles = [...document.head.querySelectorAll('style,link[rel="stylesheet"]')];
    for (const [source, copy] of copies) if (!styles.includes(source)) { copy.remove(); copies.delete(source); }
    for (const source of styles) {
      const previous = copies.get(source);
      if (previous?.isEqualNode(source)) continue;
      const copy = source.cloneNode(true) as Element;
      if (previous) previous.replaceWith(copy); else target.head.insertBefore(copy, rules);
      copies.set(source, copy);
    }
    for (const name of ['class', 'style', 'data-theme', 'lang', 'dir']) {
      const value = document.documentElement.getAttribute(name);
      if (value === null) target.documentElement.removeAttribute(name);
      else target.documentElement.setAttribute(name, value);
    }
    target.body.className = document.body.className;
  };
  const observer = new MutationObserver(sync);
  observer.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true });
  observer.observe(document.documentElement, { attributes: true });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
  return () => observer.disconnect();
}
