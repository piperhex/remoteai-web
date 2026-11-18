import { cachedHistoryHash, processHistoryWork, type HistoryWork, type HistoryWorkResult } from './historyWork';

const worker = globalThis as unknown as {
  onmessage: (event: MessageEvent<HistoryWork>) => void;
  postMessage: (value: HistoryWorkResult | null) => void;
};
const hash = cachedHistoryHash();
worker.onmessage = ({ data }) => {
  try { worker.postMessage(processHistoryWork(data, hash)); }
  catch { worker.postMessage(null); }
};
