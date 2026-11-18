interface Visibility { visible: boolean; preservePreview?: boolean }

/** Serialize native placement, keeping the last rendered page beneath application overlays. */
export function nativeSurfaceSession<Request extends Visibility>(options: {
  apply: (request: Request) => Promise<void>;
  same?: (last: Request, next: Request) => boolean;
  capture: () => Promise<string>;
  preview: (image: string | null, current: () => boolean) => Promise<void>;
  failed: (reason: unknown) => void;
}) {
  let last: Request | undefined;
  let pending: Request | undefined;
  let flight: Promise<void> | undefined;
  let closed = false;
  let visible = false;
  const preserve = async (current: () => boolean) => {
    try {
      const image = await options.capture();
      if (current()) await options.preview(image, current);
    } catch (error) {
      // A failed preview must not prevent the menu or the original page from being usable.
      console.debug('Native browser overlay preview unavailable', error);
    }
  };
  const flush = async () => {
    while (pending && !closed) {
      const request = pending; pending = undefined;
      if (last && options.same?.(last, request)) continue;
      const current = () => !closed && (!pending || pending.visible === request.visible
        && pending.preservePreview === request.preservePreview);
      try {
        if (visible && !request.visible && request.preservePreview) await preserve(current);
        if (!current()) { last = undefined; continue; }
        await options.apply(request);
        last = request;
        visible = request.visible;
        if (!closed && (visible || !request.preservePreview)) await options.preview(null, () => !closed);
      } catch (reason) { last = undefined; if (!closed) options.failed(reason); }
    }
  };
  const start = () => {
    flight = flush().finally(() => { flight = undefined; if (pending && !closed) start(); });
  };
  return {
    update: (request: Request) => {
      if (closed) return;
      pending = request;
      if (!flight) start();
    },
    close: async () => { closed = true; pending = undefined; await flight; },
  };
}
