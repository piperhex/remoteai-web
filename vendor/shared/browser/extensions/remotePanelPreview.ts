import type { usePanelTransport } from './usePanelTransport';

type Transport = ReturnType<typeof usePanelTransport>;
const CAPTURE_INTERVAL_MS = 700;
const MAX_PAUSE_RETRIES = 2;

/** One remote operation at a time, including when visibility changes during a capture. */
export function remotePanelPreview(element: HTMLElement, transport: Transport,
  publish: (image: string) => void, failed: () => void) {
  let enabled = false, stopped = false, busy = false, changed = false;
  let hostActive = true, shown = false, pauseRetries = 0;
  let width = 0, height = 0, sentWidth = 0, sentHeight = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const read = async () => {
    if (busy || stopped) return;
    busy = true; changed = false;
    let retryPause = false;
    try {
      if (transport.panelActivity && hostActive !== shown) {
        const active = shown;
        await transport.request({ action: 'activity', active });
        hostActive = active;
      }
      if (!shown || changed || stopped) return;
      if (width !== sentWidth || height !== sentHeight) {
        const size = { width, height };
        await transport.request({ action: 'resize', ...size });
        sentWidth = size.width; sentHeight = size.height;
      }
      if (!shown || changed || stopped) return;
      const { result } = await transport.request({ action: 'capture' });
      if (!result?.image) throw new Error('Browser panel preview unavailable');
      if (!stopped && shown && !changed) publish(`data:${result.image.mimeType};base64,${result.image.data}`);
    } catch {
      if (!stopped && shown) failed();
      if (!stopped && !shown && hostActive && transport.panelActivity) retryPause = ++pauseRetries <= MAX_PAUSE_RETRIES;
    }
    finally {
      busy = false;
      if (!stopped && changed) void read();
      else if (!stopped && (shown || retryPause)) timer = setTimeout(read, CAPTURE_INTERVAL_MS);
    }
  };
  const refresh = () => {
    const bounds = enabled ? element.getBoundingClientRect() : undefined;
    const nextWidth = bounds?.width ?? 0, nextHeight = bounds?.height ?? 0;
    const nextShown = nextWidth > 0 && nextHeight > 0;
    if (shown === nextShown && width === nextWidth && height === nextHeight && (!transport.panelActivity || hostActive === shown)) return;
    if (shown !== nextShown) pauseRetries = 0;
    width = nextWidth; height = nextHeight; shown = nextShown;
    clearTimeout(timer); changed = true; void read();
  };
  const resize = new ResizeObserver(refresh);
  return {
    active(value: boolean) {
      enabled = value;
      if (enabled) resize.observe(element); else resize.disconnect();
      refresh();
    },
    close() { stopped = true; clearTimeout(timer); resize.disconnect(); },
  };
}
