import { invoke } from '@tauri-apps/api/core';

export type InspectorDock = 'right' | 'bottom' | 'window';
export interface InspectorTarget { id: string; kind: 'provider' | 'conversation' }
export interface InspectorPlacement {
  action: 'place'; dock: InspectorDock; visible: boolean;
  bounds: { x: number; y: number; width: number; height: number };
}
export interface InspectorStatus { open: boolean; mobile: boolean }
type Command = InspectorPlacement | { action: 'status' | 'close' } | { action: 'setMobile'; enabled: boolean };
const operations = new Map<string, Promise<InspectorStatus>>();
const owners = new Map<string, symbol>();
const targetKey = (target: InspectorTarget) => `${target.kind}:${target.id}`;

export function inspectorCommand(target: InspectorTarget, command: Command) {
  const key = targetKey(target);
  const previous = operations.get(key) ?? Promise.resolve();
  const operation = previous.catch(() => undefined)
    .then(() => invoke<InspectorStatus>('browser_inspector', { request: { ...target, command } }));
  operations.set(key, operation);
  const cleanup = () => { if (operations.get(key) === operation) operations.delete(key); };
  void operation.then(cleanup, cleanup);
  return operation;
}

function samePlacement(previous: InspectorPlacement | undefined, next: InspectorPlacement) {
  return previous?.dock === next.dock && previous.visible === next.visible
    && previous.bounds.x === next.bounds.x && previous.bounds.y === next.bounds.y
    && previous.bounds.width === next.bounds.width && previous.bounds.height === next.bounds.height;
}

/** Coalesce geometry updates; retiring a surface hides only after its last placement completes. */
export function inspectorSession(target: InspectorTarget, onError: () => void) {
  const key = targetKey(target);
  const owner = Symbol(key); owners.set(key, owner);
  let pending: InspectorPlacement | undefined;
  let flight: Promise<void> | undefined;
  let stopped = false;
  let last: InspectorPlacement | undefined;
  let pendingScale = 1;
  let lastScale = 1;
  const flush = async () => {
    while (pending) {
      const request = pending; pending = undefined;
      const scale = pendingScale;
      // Compare after the previous command finishes: a queued resize may return to an earlier position.
      if (samePlacement(last, request) && lastScale === scale) continue;
      try { last = (await inspectorCommand(target, request)).open ? request : undefined; lastScale = scale; }
      catch { last = undefined; if (!stopped) onError(); }
    }
  };
  const start = () => {
    flight = flush().finally(() => {
      flight = undefined;
      if (pending) start();
    });
  };
  return {
    // Native placement converts CSS bounds using the current monitor's scale.
    update(request: InspectorPlacement, scale = 1) {
      if (stopped || owners.get(key) !== owner) return;
      if (!flight && samePlacement(last, request) && lastScale === scale) return;
      pending = request; pendingScale = scale;
      if (!flight) start();
    },
    async stop() {
      stopped = true; pending = undefined; await flight;
      if (owners.get(key) !== owner) return;
      owners.delete(key);
      if (last?.visible) await inspectorCommand(target, { ...last, visible: false });
    },
  };
}
