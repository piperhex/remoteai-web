import type { ZoomStep } from './zoomLevel';

export function bindZoomWheel(element: HTMLElement | Document, step: (step: ZoomStep) => void) {
  const wheel = (event: WheelEvent) => {
    if (!event.ctrlKey || !event.deltaY || event.defaultPrevented) return;
    event.preventDefault();
    step(event.deltaY < 0 ? 1 : -1);
  };
  element.addEventListener('wheel', wheel as EventListener, { passive: false });
  return () => element.removeEventListener('wheel', wheel as EventListener);
}

export function watchZoomWheel(canvas: HTMLElement, toolbar: HTMLElement, step: (step: ZoomStep) => void) {
  const documents = new Map<HTMLIFrameElement, () => void>();
  const bind = (frame: HTMLIFrameElement) => {
    for (const [previous, stop] of documents) {
      if (previous === frame || !canvas.contains(previous)) { stop(); documents.delete(previous); }
    }
    // A cross-origin frame keeps its own input. Its enclosing viewport can still be scaled from the toolbar.
    const doc = frame.contentDocument;
    if (doc) {
      documents.set(frame, bindZoomWheel(doc, step));
    }
  };
  const load = (event: Event) => { if (event.target instanceof HTMLIFrameElement) bind(event.target); };
  const home = (event: MessageEvent) => {
    if (event.origin !== 'null' || event.data?.type !== 'remoteai:browser-home:zoom') return;
    const frame = canvas.querySelector<HTMLIFrameElement>('iframe.browser-custom-home:not([hidden])');
    if (!frame || frame.contentWindow !== event.source) return;
    if (event.data.step === 1 || event.data.step === -1) step(event.data.step);
  };
  canvas.querySelectorAll('iframe').forEach(bind);
  canvas.addEventListener('load', load, true);
  const stopCanvas = bindZoomWheel(canvas, step);
  const stopToolbar = bindZoomWheel(toolbar, step);
  window.addEventListener('message', home);
  return () => {
    canvas.removeEventListener('load', load, true);
    stopCanvas();
    stopToolbar();
    window.removeEventListener('message', home);
    documents.forEach(stop => stop());
  };
}
