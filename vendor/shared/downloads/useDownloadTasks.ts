import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Dialog } from 'antd-mobile';
import { displayText, t } from '../localization/browserClient';
import { downloadManager } from './manager';
import type { DownloadOperation, DownloadTask } from './types';
import { DownloadOpenError, type DownloadOpener } from './openDownload';
import { DownloadShareError } from './shareDownload';
import { removeDownloads } from './removeDownloads';
import { controlBrowserDownload } from './browserTasks';

function confirmRemove(count?: number) {
  return Dialog.confirm({ title: count === undefined ? t('client.downloads.deleteDownload')
    : t('client.downloads.deleteSelectedTitle', { count }),
    content: t('client.downloads.removeThisWebsiteSCopyAndDownloadRecordFilesSaved'),
    confirmText: t('client.projectBrowser.deleted'), cancelText: t('client.downloads.keep'),
    bodyStyle: { maxWidth: 400 } });
}

export function useDownloadTasks(owner: string, options: {
  confirmRemove?: (count?: number) => Promise<boolean>; openDownload?: DownloadOpener; additionalOwner?: string;
  revealDownload?: DownloadOpener;
} = {}) {
  const allTasks = useSyncExternalStore(downloadManager.subscribe, downloadManager.snapshot);
  const current = useSyncExternalStore(downloadManager.subscribe, downloadManager.connection);
  const storageError = useSyncExternalStore(downloadManager.subscribe, downloadManager.error);
  const connection = current?.owner === owner ? current : undefined;
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  useEffect(() => { void downloadManager.initialize(); }, []);
  const tasks = allTasks.filter(task => (task.source.owner === owner || task.source.owner === options.additionalOwner)
    && (!task.source.preview || task.exported)).slice().reverse();
  const removeTasks = async (ids: readonly string[], batch = true) => {
    const targets = tasks.filter(task => ids.includes(task.id));
    if (pending.current || !targets.length) return;
    pending.current = true; setBusy(targets[0].id); setError('');
    try {
      const confirmed = await (options.confirmRemove ?? confirmRemove)(batch ? targets.length : undefined);
      if (!confirmed) return;
      const failed = await removeDownloads(targets.map(task => task.id), id => downloadManager.remove(id));
      if (failed.length) setError(t('client.downloads.deleteFailed'));
    } catch { setError(t('client.downloads.deleteFailed')); }
    finally { pending.current = false; setBusy(''); }
  };
  const run = async (task: DownloadTask, operation: DownloadOperation = 'action') => {
    if (operation === 'remove') return removeTasks([task.id], false);
    if (pending.current) return;
    pending.current = true; setBusy(task.id); setError('');
    try {
      if (task.browser) await controlBrowserDownload(task, operation);
      else if (operation === 'open') await downloadManager.open(task.id, options.openDownload);
      else if (operation === 'reveal') {
        if (options.revealDownload) await downloadManager.open(task.id, options.revealDownload);
      }
      else if (operation === 'share') await downloadManager.share(task.id);
      else if (operation === 'retry') await downloadManager.resume(task.id);
      else if (['completed', 'ready'].includes(task.status)) await downloadManager.save(task.id);
      else if (['queued', 'preparing', 'downloading', 'verifying'].includes(task.status)) await downloadManager.pause(task.id);
      else await downloadManager.resume(task.id);
    } catch (cause) {
      if (task.browser) { setError(displayText('client.downloads.browser.unavailable')); return; }
      const knownError = cause instanceof DownloadOpenError || cause instanceof DownloadShareError;
      setError(knownError ? cause.message : operation === 'open' || operation === 'reveal'
        ? '打开未完成，请重试或保存到设备后打开。' : '操作未完成，请检查浏览器存储空间后重试。');
    }
    finally { pending.current = false; setBusy(''); }
  };
  return { connection, busy, error: error || storageError, run, removeTasks, tasks };
}
