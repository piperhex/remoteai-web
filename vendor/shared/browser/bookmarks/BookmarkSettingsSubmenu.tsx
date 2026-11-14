import { useState } from 'react';
import { BookMarked, ChevronLeft, ChevronRight, Folder } from 'lucide-react';
import type { MarketText } from '../../provider-market/i18n';
import { BrowserWebsiteIcon } from '../icons/BrowserWebsiteIcon';
import { BrowserSettingsSubmenu } from '../BrowserSettingsSubmenu';
import type { Bookmark } from './model';

export function BookmarkSettingsSubmenu({ entries, t, visit, manage }: {
  entries: Bookmark[]; t: MarketText; visit: (entry: Bookmark, newTab?: boolean) => void; manage: () => void;
}) {
  return <BrowserSettingsSubmenu icon={BookMarked} title={t('market.bookmarkAll')}
    footer={<button type="button" role="menuitem" className="browser-settings-action" onClick={manage}>
      <BookMarked size="1.25em" /><span>{t('market.bookmarkManage')}</span>
    </button>}>
    <BookmarkChoices entries={entries} t={t} visit={visit} />
  </BrowserSettingsSubmenu>;
}

function BookmarkChoices({ entries, t, visit }: {
  entries: Bookmark[]; t: MarketText; visit: (entry: Bookmark, newTab?: boolean) => void;
}) {
  const [folder, setFolder] = useState('');
  const parent = entries.find(entry => entry.id === folder && entry.kind === 'folder');
  const shown = entries.filter(entry => entry.parentId === (parent?.id ?? ''));
  return <>
    {parent && <button type="button" role="menuitem" className="browser-settings-action"
      aria-label={t('market.browserBack')} onClick={() => setFolder(parent.parentId)}>
      <ChevronLeft size="1.25em" /><span>{parent.title}</span>
    </button>}
    {!shown.length && <p className="browser-settings-submenu-hint">{t('market.bookmarkEmpty')}</p>}
    {shown.map(entry => <button key={entry.id} type="button" role="menuitem"
      className="browser-settings-action" title={entry.kind === 'link' ? entry.url : entry.title}
      onClick={event => entry.kind === 'folder' ? setFolder(entry.id) : visit(entry, event.ctrlKey || event.metaKey)}>
      {entry.kind === 'folder' ? <Folder size="1.25em" /> : <BrowserWebsiteIcon url={entry.url} size={16} />}
      <span>{entry.title}</span>{entry.kind === 'folder' && <ChevronRight size="1.1em" />}
    </button>)}
  </>;
}
