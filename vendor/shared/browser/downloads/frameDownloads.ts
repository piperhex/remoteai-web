/** Cross-origin documents remain under the host browser's download controls. */
export function observeFrameDownloads(frame: HTMLIFrameElement | null, enqueue: (url: URL, name: string) => void,
  active: () => boolean) {
  const page = frame?.contentDocument;
  if (!page) return;
  const click = (event: MouseEvent) => {
    if (!active() || event.defaultPrevented || event.button !== 0
      || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) {
      return;
    }
    const anchor = (event.target as Element | null)?.closest?.<HTMLAnchorElement>('a[download][href]');
    if (!anchor?.href) return;
    let url: URL;
    try { url = new URL(anchor.href); } catch { return; }
    if (!/^https?:$/.test(url.protocol) || url.origin !== window.location.origin || url.username || url.password) return;
    event.preventDefault();
    enqueue(url, anchor.download);
  };
  page.addEventListener('click', click);
  return () => page.removeEventListener('click', click);
}
