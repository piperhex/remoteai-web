import { useState, type CSSProperties } from 'react';
import { Button, Empty, Input, Modal, Popconfirm, theme } from 'antd';
import { ArrowDown, ArrowUp, Folder, Pencil, Trash2 } from 'lucide-react';
import type { MarketText } from '../../provider-market/i18n';
import { BrowserWebsiteIcon } from '../icons/BrowserWebsiteIcon';
import type { Bookmark } from './model';
import { useBookmarks } from './context';
import { useBookmarkDrag } from './useBookmarkDrag';

export function BookmarkManager({ t, close, edit, create, visit }: {
  t: MarketText; close: () => void; edit: (entry: Bookmark) => void;
  create: (kind: Bookmark['kind']) => void; visit: (entry: Bookmark) => void;
}) {
  const { entries, store } = useBookmarks();
  const { token } = theme.useToken();
  const [query, setQuery] = useState('');
  const drag = useBookmarkDrag({ entries, axis: 'y', reorder: store.reorder });
  const filtered = entries.filter(entry => `${entry.title} ${entry.url}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const move = (entry: Bookmark, direction: number) => {
    const siblings = entries.filter(item => item.parentId === entry.parentId);
    const index = siblings.findIndex(item => item.id === entry.id);
    const target = index + direction;
    if (target < 0 || target >= siblings.length) return;
    store.reorder(entry.id, siblings[target].id, direction > 0);
  };
  const colors = { '--border': token.colorBorderSecondary,
    '--text-secondary': token.colorTextSecondary } as CSSProperties;
  return <Modal open title={t('market.bookmarkManage')} onCancel={close} footer={null} width={680} zIndex={1750}
    className="browser-chrome" styles={{ body: colors }}>
    <div className="browser-bookmark-manager-tools">
      <Input value={query} aria-label={t('market.bookmarkSearch')} placeholder={t('market.bookmarkSearch')}
        onChange={event => setQuery(event.target.value)} />
      <Button onClick={() => create('link')}>{t('market.bookmarkAdd')}</Button>
      <Button onClick={() => create('folder')}>{t('market.bookmarkFolder')}</Button>
    </div>
    <div {...drag.handlers} className="browser-bookmark-list">
      {!filtered.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('market.bookmarkEmpty')} />}
      {filtered.map(entry => <div className={`browser-bookmark-row ${drag.className(entry.id)}`}
        data-bookmark-id={entry.id} key={entry.id}>
        <button data-bookmark-drag className="browser-bookmark-row-name"
          onClick={() => entry.kind === 'folder' ? edit(entry) : visit(entry)}>
          {entry.kind === 'folder' ? <Folder size={16} /> : <BrowserWebsiteIcon url={entry.url} size={16} />}
          <span><strong>{entry.title}</strong><small>{entry.kind === 'folder' ? t('market.bookmarkFolder') : entry.url}</small>
            {entry.parentId && <small>{entries.find(item => item.id === entry.parentId)?.title}</small>}</span>
        </button>
        <Button type="text" aria-label={t('market.bookmarkMoveUp')} icon={<ArrowUp size={15} />}
          onClick={() => move(entry, -1)} />
        <Button type="text" aria-label={t('market.bookmarkMoveDown')} icon={<ArrowDown size={15} />}
          onClick={() => move(entry, 1)} />
        <Button type="text" aria-label={t('market.bookmarkEdit')} icon={<Pencil size={15} />} onClick={() => edit(entry)} />
        <Popconfirm title={t('market.bookmarkDeleteConfirm')} overlayStyle={{ maxWidth: 400 }} zIndex={1900}
          overlayClassName="browser-chrome"
          onConfirm={() => store.remove(entry.id)} okText={t('market.bookmarkDelete')} cancelText={t('market.cancel')}>
          <Button type="text" danger aria-label={t('market.bookmarkDelete')} icon={<Trash2 size={15} />} />
        </Popconfirm>
      </div>)}
    </div>
  </Modal>;
}
