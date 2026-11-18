const overlays = 'dialog[open], [aria-modal="true"]';

export function watchPanelLayout(host: HTMLElement, sync: () => void) {
  let frame = 0;
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; sync(); });
  };
  const resize = new ResizeObserver(schedule);
  const ancestry = new MutationObserver(schedule);
  for (let node: HTMLElement | null = host; node; node = node.parentElement) {
    resize.observe(node);
    ancestry.observe(node, { attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
  }

  // Track modal insertion/removal and display changes without measuring layout on chat mutations.
  const modalSizes = new ResizeObserver(schedule);
  const watchModals = () => {
    modalSizes.disconnect();
    document.querySelectorAll(overlays).forEach(node => modalSizes.observe(node));
    schedule();
  };
  const containsModal = (node: Node) => node instanceof Element
    && (node.matches(overlays) || node.childElementCount > 0 && !!node.querySelector(overlays));
  const modals = new MutationObserver(records => {
    if (records.some(record => record.type === 'attributes'
      || [...record.addedNodes, ...record.removedNodes].some(containsModal))) watchModals();
  });
  modals.observe(document.body, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['open', 'aria-modal'] });
  watchModals();
  const scroll = (event: Event) => {
    if (!(event.target instanceof Element) || event.target.contains(host)) schedule();
  };
  window.addEventListener('scroll', scroll, true);
  window.addEventListener('resize', schedule);
  return () => {
    resize.disconnect(); ancestry.disconnect(); modalSizes.disconnect(); modals.disconnect();
    window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', schedule);
    cancelAnimationFrame(frame);
  };
}
