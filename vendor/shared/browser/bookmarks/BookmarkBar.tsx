import { Dropdown, type MenuProps } from 'antd';
import { useEffect, useState } from 'react';
import { Ellipsis, Folder, PanelsTopLeft } from 'lucide-react';
import { useTabOverflow } from '../../project-browser/useTabOverflow';
import { BrowserWebsiteIcon } from '../icons/BrowserWebsiteIcon';
import type { Bookmark } from './model';
import { BookmarkContextMenu, type BookmarkActions } from './BookmarkContextMenu';
import type { useBookmarkDrag } from './useBookmarkDrag';
import { useThreadLongPress } from '../../chat/useThreadLongPress';

interface Props extends BookmarkActions {
  entries: Bookmark[];
}

function childrenOf(entries: Bookmark[], parentId: string) {
  return entries.filter(entry => entry.parentId === parentId);
}

function bookmarkItems(props: Props, entries: Bookmark[], depth = 0): NonNullable<MenuProps['items']> {
  if (depth > 8) return [];
  return entries.map(entry => ({
    key: entry.id, label: <BookmarkContextMenu {...props} entry={entry}>{entry.title}</BookmarkContextMenu>,
    icon: entry.kind === 'folder' ? <Folder size={15} />
      : <span><BrowserWebsiteIcon url={entry.url} size={15} /></span>,
    ...(entry.kind === 'folder' ? { children: bookmarkItems(props, childrenOf(props.entries, entry.id), depth + 1) }
      : { onClick: ({ domEvent }) => props.visit(entry, domEvent.ctrlKey || domEvent.metaKey) }),
  }));
}

function BookmarkButton({ entry, dragClass, hidden, ...props }: Props & {
  entry: Bookmark; dragClass: string; hidden: boolean;
}) {
  const { visit, menuChanged } = props;
  const button = <button data-bookmark-id={entry.id} data-bookmark-drag type="button"
    data-overflow-tab data-path={entry.id} data-overflow-hidden={hidden}
    className={`browser-bookmark-item ${dragClass}`}
    title={entry.kind === 'folder' ? entry.title : `${entry.title}\n${entry.url}`}
    onClick={event => { if (entry.kind === 'link') visit(entry, event.ctrlKey || event.metaKey); }}>
    {entry.kind === 'folder' ? <Folder size={16} /> : <BrowserWebsiteIcon url={entry.url} size={16} />}
    <span>{entry.title}</span>
  </button>;
  return <BookmarkContextMenu {...props} entry={entry}>
    {entry.kind === 'folder' ? <Dropdown trigger={['click']} onOpenChange={menuChanged}
      overlayClassName="browser-bookmark-menu" menu={{ items: bookmarkItems(props, childrenOf(props.entries, entry.id)) }}>
      {button}</Dropdown> : button}
  </BookmarkContextMenu>;
}

function BookmarkOverflowMenu({ items, t, menuChanged }: Pick<Props, 't' | 'menuChanged'> & {
  items: MenuProps['items'];
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    menuChanged(true);
    return () => menuChanged(false);
  }, [open, menuChanged]);
  const label = t('market.moreActions');
  return <Dropdown trigger={['click']} placement="bottomRight" autoFocus open={open} onOpenChange={setOpen}
    overlayClassName="browser-bookmark-menu" menu={{ 'aria-label': label, items }}>
    <button type="button" title={label} aria-label={label} aria-haspopup="menu" aria-expanded={open}>
      <Ellipsis size={18} /></button>
  </Dropdown>;
}

export function BookmarkBar({ drag, newFolder, newFolderLabel, ...props }: Props & {
  drag: ReturnType<typeof useBookmarkDrag>; newFolder: () => void; newFolderLabel: string;
}) {
  const { entries, t } = props;
  const blankMenu = useThreadLongPress(press => {
    press.target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true,
      clientX: press.x, clientY: press.y }));
  }, { nativeContextMenu: true });
  const roots = childrenOf(entries, '');
  const overflow = useTabOverflow(roots.map(entry => ({ path: entry.id })));
  const hidden = new Set(overflow.hiddenPaths);
  return <div {...drag.handlers} className="browser-bookmark-bar" role="navigation" aria-label={t('market.bookmarkBar')}>
    <Dropdown trigger={['contextMenu']} onOpenChange={props.menuChanged} overlayClassName="browser-bookmark-menu"
      menu={{ items: [{ key: 'folder', label: newFolderLabel, onClick: newFolder }] }}>
      <span {...blankMenu} className="browser-bookmark-background" onPointerDown={event => {
        if (event.pointerType !== 'mouse') blankMenu.onPointerDown(event);
      }} />
    </Dropdown>
    <div className="browser-bookmark-strip" ref={overflow.bar}>
      <div className="browser-bookmark-items" ref={overflow.viewport}>
        {roots.map(entry => <BookmarkButton {...props} entry={entry} hidden={hidden.has(entry.id)}
          dragClass={drag.className(entry.id)} key={entry.id} />)}
        {!entries.length && <span className="browser-bookmark-empty">{t('market.bookmarkEmpty')}</span>}
      </div>
      {overflow.overflowing && <BookmarkOverflowMenu t={t} menuChanged={props.menuChanged}
        items={bookmarkItems(props, roots.filter(entry => hidden.has(entry.id)))} />}
    </div>
    <Dropdown trigger={['click']} onOpenChange={props.menuChanged} overlayClassName="browser-bookmark-menu"
      menu={{ items: [...bookmarkItems(props, roots), { type: 'divider' },
        { key: 'manage', label: t('market.bookmarkManage'), onClick: props.manage }] }}>
      <button type="button" className="browser-bookmark-all" title={t('market.bookmarkAll')}
        aria-label={t('market.bookmarkAll')}><PanelsTopLeft size={16} /><span>{t('market.bookmarkAll')}</span></button>
    </Dropdown>
  </div>;
}
