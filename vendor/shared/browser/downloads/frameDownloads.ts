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
    const fromPage = url.protocol === 'data:' || url.origin === window.location.origin;
    if (!fromPage || !/^(?:https?|blob|data):$/.test(url.protocol) || url.username || url.password) return;
    event.preventDefault();
    enqueue(url, anchor.download);
  };
  page.addEventListener('click', click);
  const prototype: HTMLAnchorElement = Object.getPrototypeOf(page.createElement('a'));
  const original = prototype.click;
  const observeDetached = function (this: HTMLAnchorElement) {
    if (this.isConnected) return original.call(this);
    this.addEventListener('click', click);
    try { original.call(this); }
    finally { this.removeEventListener('click', click); }
  };
  prototype.click = observeDetached;
  return () => {
    page.removeEventListener('click', click);
    if (prototype.click === observeDetached) prototype.click = original;
  };
}
