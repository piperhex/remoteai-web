import { Dropdown, type MenuProps } from 'antd';
import { useEffect } from 'react';
import { Folder, PanelsTopLeft } from 'lucide-react';
import { BrowserWebsiteIcon } from '../icons/BrowserWebsiteIcon';
import type { Bookmark } from './model';
import { BookmarkContextMenu, type BookmarkActions } from './BookmarkContextMenu';
import { useBookmarks } from './context';
import { useBookmarkDrag } from './useBookmarkDrag';

interface Props extends BookmarkActions {
  entries: Bookmark[]; dragChanged: (dragging: boolean) => void;
}

function folderItems(props: Props, parentId: string, depth = 0): MenuProps['items'] {
  if (depth > 8) return [];
  return props.entries.filter(entry => entry.parentId === parentId).map(entry => ({
    key: entry.id, label: <BookmarkContextMenu {...props} entry={entry}>{entry.title}</BookmarkContextMenu>,
    icon: entry.kind === 'folder' ? <Folder size={15} />
      : <BrowserWebsiteIcon url={entry.url} size={15} />,
    ...(entry.kind === 'folder' ? { children: folderItems(props, entry.id, depth + 1) }
      : { onClick: () => props.visit(entry) }),
  }));
}

function BookmarkButton({ entry, dragClass, ...props }: Props & { entry: Bookmark; dragClass: string }) {
  const { visit, menuChanged } = props;
  const button = <button data-bookmark-id={entry.id} data-bookmark-drag type="button"
    className={`browser-bookmark-item ${dragClass}`}
    title={entry.kind === 'folder' ? entry.title : `${entry.title}\n${entry.url}`}
    onClick={event => { if (entry.kind === 'link') visit(entry, event.ctrlKey || event.metaKey); }}>
    {entry.kind === 'folder' ? <Folder size={16} /> : <BrowserWebsiteIcon url={entry.url} size={16} />}
    <span>{entry.title}</span>
  </button>;
  return <BookmarkContextMenu {...props} entry={entry}>
    {entry.kind === 'folder' ? <Dropdown trigger={['click']} onOpenChange={menuChanged}
      overlayClassName="browser-bookmark-menu" menu={{ items: folderItems(props, entry.id) }}>{button}</Dropdown> : button}
  </BookmarkContextMenu>;
}

export function BookmarkBar(props: Props) {
  const { entries, t, dragChanged } = props;
  const { store } = useBookmarks();
  const drag = useBookmarkDrag({ entries, axis: 'x', reorder: store.reorder });
  useEffect(() => { dragChanged(drag.dragging); return () => dragChanged(false); }, [drag.dragging, dragChanged]);
  return <div {...drag.handlers} className="browser-bookmark-bar" role="navigation" aria-label={t('market.bookmarkBar')}>
    <div className="browser-bookmark-items">
      {entries.filter(entry => !entry.parentId).map(entry => <BookmarkButton {...props} entry={entry}
        dragClass={drag.className(entry.id)} key={entry.id} />)}
      {!entries.length && <span className="browser-bookmark-empty">{t('market.bookmarkEmpty')}</span>}
    </div>
    <Dropdown trigger={['click']} onOpenChange={props.menuChanged} overlayClassName="browser-bookmark-menu"
      menu={{ items: [...folderItems(props, '') ?? [], { type: 'divider' },
        { key: 'manage', label: t('market.bookmarkManage'), onClick: props.manage }] }}>
      <button type="button" className="browser-bookmark-all" title={t('market.bookmarkAll')}
        aria-label={t('market.bookmarkAll')}><PanelsTopLeft size={16} /><span>{t('market.bookmarkAll')}</span></button>
    </Dropdown>
  </div>;
}
