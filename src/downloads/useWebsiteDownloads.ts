import { useMemo } from 'react';
import { Toast } from 'antd-mobile';
import { t } from '../../../../shared/localization/browserClient';
import { enqueueWebsiteDownload } from '../../../../shared/browser/downloads/websiteDownloads';

export function useWebsiteDownloads(owner: string | undefined, open: () => void) {
  return useMemo(() => owner ? {
    open,
    enqueue: (url: URL, name: string) => {
      void enqueueWebsiteDownload(owner, url, name)
        .then(() => Toast.show({ position: 'top', icon: 'success', content: t('client.downloads.browser.added') }))
        .catch(() => Toast.show({ position: 'top', icon: 'fail', content: t('client.downloads.browser.failed') }));
    },
  } : undefined, [owner, open]);
}
