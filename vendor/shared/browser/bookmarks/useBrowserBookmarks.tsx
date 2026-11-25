import { useState, type ReactNode } from 'react';
import { Button, Modal, Popover, Switch, theme } from 'antd';
import { isTauri } from '@tauri-apps/api/core';
import { BookMarked, Check, ChevronRight, Cloud, PanelTop, RotateCw, Settings, Star } from 'lucide-react';
import type { BrowserTab } from '../../provider-market/browserState';
import type { MarketText } from '../../provider-market/i18n';
import { bookmarkUrl, pageBookmark, type Bookmark } from './model';
import { useBookmarks } from './context';
import { BookmarkBar } from './BookmarkBar';
import { BookmarkEditor } from './BookmarkEditor';
import { BookmarkManager } from './BookmarkManager';
import { BookmarkSettingsSubmenu } from './BookmarkSettingsSubmenu';
import { bookmarkStatusKeys } from './status';
import { BookmarkDrawer } from './BookmarkDrawer';
import { useCompactBrowser } from './useCompactBrowser';
import { useCurrentBookmark } from './useCurrentBookmark';
import { useBookmarkDrag } from './useBookmarkDrag';
import { BrowserSettingsAction, BrowserSettingsPanel } from '../BrowserSettings';
import './bookmarks.css';


export function useBrowserBookmarks(options: {
  tab?: BrowserTab; t: MarketText; navigate: (url: string) => void; newTab: (url: string) => void;
  reload?: () => void; newFolderLabel: string;
  settingsContent?: (dismiss: () => void) => ReactNode;
}) {
  const { tab, t } = options;
  const narrow = useCompactBrowser();
  const compact = narrow && !isTauri();
  const { token } = theme.useToken();
  const { entries, showBar, status, store } = useBookmarks();
  const [settings, setSettings] = useState(false);
  const [menu, setMenu] = useState(false);
  const [manager, setManager] = useState(false);
  const [editor, setEditor] = useState<{ entry: Bookmark; creatingInFolder?: boolean }>();
  const [deleting, setDeleting] = useState<Bookmark>();
  const drag = useBookmarkDrag(store, 'x');
  const address = tab && bookmarkUrl(tab.url);
  const saved = address && entries.find(entry => entry.kind === 'link' && entry.url === address);
  const current = useCurrentBookmark({ url: tab?.url ?? '', title: tab?.title ?? '', newId: () => crypto.randomUUID() });
  const create = (kind: Bookmark['kind'], prefill = false, folder?: Bookmark) => {
    const id = crypto.randomUUID();
    const page = prefill && tab ? pageBookmark(tab, () => id) : undefined;
    setMenu(false);
    setEditor({ creatingInFolder: !!folder, entry: { id, kind, title: page?.title ?? '', url: page?.url ?? '',
      parentId: folder?.id ?? '', position: Math.max(-1, ...entries.map(entry => entry.position)) + 1 } });
  };
  const visit = (entry: Bookmark, newTab = false) => {
    setMenu(false); setSettings(false); setManager(false);
    if (newTab || !tab) options.newTab(entry.url); else options.navigate(entry.url);
  };
  const manage = () => { setMenu(false); setSettings(false); setManager(true); };
  const edit = (entry: Bookmark) => { setMenu(false); setEditor({ entry }); };
  const remove = (entry: Bookmark) => { setMenu(false); setDeleting(entry); };
  return {
    manage,
    tabDragHandlers: drag.tabHandlers,
    overlayOpen: settings || menu || manager || !!editor || !!deleting || drag.dragging,
    star: <button type="button" aria-label={t(saved ? 'market.bookmarkEdit' : 'market.bookmarkAdd')}
      title={t(saved ? 'market.bookmarkEdit' : 'market.bookmarkAdd')} disabled={!address} aria-pressed={!!saved}
      className="browser-bookmark-star" onClick={() => saved ? edit(saved) : create('link', true)}>
      <Star size={17} fill={saved ? 'currentColor' : 'none'} /></button>,
    settings: <Popover trigger="click" placement="bottomRight" open={settings} onOpenChange={setSettings} destroyOnHidden
      overlayClassName="browser-bookmark-settings-popup" zIndex={1700} arrow={false}
      styles={{ body: { padding: 6, borderRadius: 12, border: `1px solid ${token.colorBorderSecondary}` } }}
      content={<BrowserSettingsPanel title={t('market.browserSettings')} footer={<>
        <Cloud size="1.2em" /><div style={{ fontSize: token.fontSizeSM }}>
          <span role="status">{t(bookmarkStatusKeys[status])}</span>
          {(status === 'offline' || status === 'storage-error') && <Button size="small" onClick={store.refresh}>
            {t('market.retry')}</Button>}
        </div>
      </>}>
        {options.reload && <BrowserSettingsAction icon={RotateCw} disabled={!tab?.url} onClick={() => {
          setSettings(false); options.reload?.();
        }}>{t('market.browserReload')}</BrowserSettingsAction>}
        <BrowserSettingsAction disabled={!current.available || current.saved} pressed={current.saved}
          icon={current.saved ? Check : Star} onClick={current.add}>
          {t('market.bookmarkAdd')}</BrowserSettingsAction>
        {current.invalid && <span role="alert">{t('market.bookmarkInvalid')}</span>}
        {options.settingsContent?.(() => setSettings(false))}
        <div className="browser-settings-divider" />
        <div className="browser-settings-row"><PanelTop size="1.25em" />
          <span className="browser-settings-label">{t('market.bookmarkShowBar')}</span>
          <Switch size="small" checked={showBar} aria-label={t('market.bookmarkShowBar')} onChange={store.setShowBar} />
        </div>
        {compact ? <BrowserSettingsAction icon={BookMarked} onClick={manage}
          trailing={<ChevronRight size="1.1em" />}>{t('market.bookmarkAll')}</BrowserSettingsAction>
          : <BookmarkSettingsSubmenu entries={entries} t={t} visit={visit} manage={manage} />}
      </BrowserSettingsPanel>}>
      <button type="button" aria-label={t('market.browserSettings')} title={t('market.browserSettings')}>
        <Settings size={17} /></button>
    </Popover>,
    bar: showBar && <BookmarkBar entries={entries} t={t} visit={visit} edit={edit} remove={remove}
      manage={manage} menuChanged={setMenu} drag={drag} newFolderLabel={options.newFolderLabel}
      newFolder={folder => create('folder', false, folder)} addPage={folder => create('link', true, folder)} />,
    overlays: <>{manager && (compact
      ? <BookmarkDrawer t={t} close={() => setManager(false)} visit={visit} add={() => create('link', true)} />
      : <BookmarkManager t={t} close={() => setManager(false)} edit={edit} create={create} visit={visit} />)}
      {deleting && <Modal open className="browser-chrome" width={400} zIndex={1850} title={t('market.bookmarkDelete')}
        okText={t('market.bookmarkDelete')} cancelText={t('market.cancel')} okButtonProps={{ danger: true }}
        onCancel={() => setDeleting(undefined)} onOk={() => { store.remove(deleting.id); setDeleting(undefined); }}>
        <p>{t('market.bookmarkDeleteConfirm')}</p>
        <span style={{ overflowWrap: 'anywhere', color: token.colorTextSecondary }}>{deleting.title}</span>
      </Modal>}
      {editor && <BookmarkEditor key={editor.entry.id} {...editor} t={t} close={() => setEditor(undefined)} />}</>,
  };
}
