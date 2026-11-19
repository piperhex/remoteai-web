import { useContext, useEffect, useRef, useState } from 'react';
import { Dropdown, type MenuProps } from 'antd';
import { ChevronDown, ExternalLink, Globe, Paperclip } from 'lucide-react';
import { BrowserNavigationContext } from '../../../../shared/browser/BrowserNavigationProvider';
import { downloadedFileReferenceError, useReferenceDownloadedFile } from '../../../../shared/chat/DownloadedFileContext';
import { readFileBase64 } from '../../../../shared/chat/fileData';
import { fileResourceUrl } from '../../../../shared/file-preview/resourceAddress';
import { LoungeFilePreviewContent } from '../../../../shared/lounge/LoungeFilePreviewContent';
import { displayError, t } from '../../../../shared/localization/browserClient';
import { downloadManager } from '../../../../shared/downloads/manager';
import { verifiedDownloadContent } from '../../../../shared/downloads/openDownload';
import { canPreviewCompletedDownload, downloadedDocument } from '../../../../shared/downloads/previewCompletedDownload';
import type { DownloadTask } from '../../../../shared/downloads/types';
import { checkFileUploadSize } from '../../../../shared/remote-chat/policy';

async function readDownload(task: DownloadTask) {
  let file: Blob | undefined;
  await downloadManager.open(task.id, async saved => { file = await verifiedDownloadContent(saved); });
  if (!file) throw new Error('client.filePreview.unavailable');
  return file;
}

function DownloadPreview({ task }: { task: DownloadTask }) {
  const [bytes, setBytes] = useState<Uint8Array>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    void readDownload(task).then(file => file.arrayBuffer()).then(buffer => {
      if (current) setBytes(new Uint8Array(buffer));
    }).catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [task]);
  if (bytes) return <LoungeFilePreviewContent file={downloadedDocument(task)} bytes={bytes} />;
  return <p role="status" className="file-preview-feedback">
    {t(failed ? 'client.filePreview.unavailable' : 'client.projectBrowser.loading')}</p>;
}

export function DownloadFileMenu({ task, busy, onOpen, onReference }: {
  task: DownloadTask; busy: boolean; onOpen: () => void; onReference?: () => void;
}) {
  const browser = useContext(BrowserNavigationContext);
  const addReference = useReferenceDownloadedFile();
  const pending = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const reference = async () => {
    if (pending.current) return;
    pending.current = true; setLoading(true); setError('');
    try {
      await addReference(async mode => {
        checkFileUploadSize(task.size, mode);
        const blob = await readDownload(task);
        checkFileUploadSize(blob.size, mode);
        const data = await readFileBase64(new File([blob], task.name));
        return { kind: 'file', name: task.name, path: '', data };
      });
      onReference?.();
    } catch (cause) {
      setError(displayError(downloadedFileReferenceError(cause)));
    } finally { pending.current = false; setLoading(false); }
  };
  const items: MenuProps['items'] = [{ key: 'open', label: t('client.workspaceActions.openInBrowser'),
    icon: <ExternalLink size={16} />, onClick: onOpen }];
  if (!task.browser && browser && canPreviewCompletedDownload(task)) items.push({ key: 'preview',
    label: t('client.filePreview.openInBuiltInBrowser'), icon: <Globe size={16} />,
    onClick: () => browser.openResource({ key: task.id, title: task.name, url: fileResourceUrl(`/Downloads/${task.name}`),
      render: () => <DownloadPreview task={task} /> }) });
  if (!task.browser && onReference) items.push({ key: 'reference', label: t('client.projectBrowser.referenceFile'),
    icon: <Paperclip size={16} />, onClick: () => { void reference(); } });
  return <>
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight" disabled={busy || loading}>
      <button type="button" aria-haspopup="menu" className="download-button" disabled={busy || loading}>
        {t('client.portForwarding.open')}<ChevronDown size={17} /></button>
    </Dropdown>
    {error && <p role="alert" className="download-notice">{error}</p>}
  </>;
}
