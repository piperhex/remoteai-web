import { AsyncHistoryVersionCache, type HistoryFields } from './client/historyPreparation';
import { uiText } from '../localization/uiText';
import type { Thread } from './client/types';
import type { HistoryVersion } from './historySync';
import { processHistoryWork, type HistoryWork, type HistoryWorkResult } from './historyWork';

const REQUEST_TIMEOUT_MS = 15_000;
const WORKER_IDLE_MS = 60_000;
let worker: Worker | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let retryAfter = 0;
let queue = Promise.resolve();

function releaseWorker() {
  worker?.terminate();
  worker = undefined;
}

function postHistoryWork(work: HistoryWork): Promise<HistoryWorkResult | null> {
  if (typeof Worker === 'undefined' || Date.now() < retryAfter) return Promise.resolve(null);
  clearTimeout(idleTimer);
  return new Promise(resolve => {
    try { worker ??= new Worker(new URL('./history.worker.ts', import.meta.url), { type: 'module' }); }
    catch { retryAfter = Date.now() + WORKER_IDLE_MS; resolve(null); return; }
    const current = worker;
    const finish = (result: HistoryWorkResult | null) => {
      clearTimeout(timeout);
      current.onmessage = current.onerror = current.onmessageerror = null;
      resolve(result);
    };
    const failed = () => {
      retryAfter = Date.now() + WORKER_IDLE_MS;
      finish(null);
      releaseWorker();
    };
    const timeout = setTimeout(failed, REQUEST_TIMEOUT_MS);
    current.onmessage = ({ data }: MessageEvent<HistoryWorkResult | null>) => {
      finish(data);
      idleTimer = setTimeout(releaseWorker, WORKER_IDLE_MS);
    };
    current.onerror = current.onmessageerror = failed;
    try { current.postMessage(work); }
    catch { failed(); }
  });
}

/** Serialize jobs so only the worker's active snapshot needs a structured clone. */
function runHistoryWork(work: HistoryWork) {
  const result = queue.then(async () => (await postHistoryWork(work)) ?? processHistoryWork(work));
  queue = result.then(() => {}, () => {});
  return result;
}

type FieldResult = { fields: HistoryFields };
interface FieldRequest {
  value: object;
  resolve: (value: FieldResult) => void;
  reject: (error: unknown) => void;
}
let pendingFields: FieldRequest[] = [];
const processingError = () => new Error(uiText('client.mobile.couldNotProcessChatHistoryTryAgain'));

async function flushFields() {
  const batch = pendingFields;
  pendingFields = [];
  try {
    const result = await runHistoryWork({ action: 'fields', values: batch.map(request => request.value) });
    if (result.action !== 'fields' || result.fields.length !== batch.length) throw processingError();
    batch.forEach((request, index) => request.resolve({ fields: result.fields[index] }));
  } catch (error) { batch.forEach(request => request.reject(error)); }
}

function prepareFields(value: object) {
  return new Promise<FieldResult>((resolve, reject) => {
    if (!pendingFields.length) queueMicrotask(() => void flushFields());
    pendingFields.push({ value, resolve, reject });
  });
}

export function createBrowserHistoryVersions() {
  const fields = new WeakMap<object, Map<string, Promise<FieldResult>>>();
  return new AsyncHistoryVersionCache((value, omit = '') => {
    let versions = fields.get(value);
    if (!versions) { versions = new Map(); fields.set(value, versions); }
    const cache = versions;
    let cached = cache.get(omit);
    if (!cached) {
      // Drop child collections before structured cloning metadata to the worker.
      const metadata = omit ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== omit)) : value;
      cached = prepareFields(metadata).catch((error: unknown) => { cache.delete(omit); throw error; });
      cache.set(omit, cached);
    }
    return cached;
  });
}

export async function prepareBrowserHistoryDelta(thread: Thread, known?: HistoryVersion) {
  const result = await runHistoryWork({ action: 'delta', thread, known });
  if (result.action !== 'delta') throw processingError();
  return result;
}
