import { Tree, theme } from 'antd';
import { Folder } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import type { Bookmark } from './model';

const BAR_KEY = ':bar';
interface FolderNode { key: string; title: string; children: FolderNode[] }

function folderTree(entries: Bookmark[], barLabel: string) {
  const root: FolderNode = { key: BAR_KEY, title: barLabel, children: [] };
  const folders = entries.filter(entry => entry.kind === 'folder');
  const nodes = new Map<string, FolderNode>([['', root]]);
  for (const folder of folders) nodes.set(folder.id, { key: folder.id, title: folder.title, children: [] });
  for (const folder of folders) nodes.get(folder.parentId)?.children.push(nodes.get(folder.id)!);
  return [root];
}

export function BookmarkFolderPicker({ entries, barLabel, label, value, onChange }: {
  entries: Bookmark[]; barLabel: string; label: string; value: string; onChange: (id: string) => void;
}) {
  const { token } = theme.useToken();
  const tree = useMemo(() => folderTree(entries, barLabel), [entries, barLabel]);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    container.current?.querySelector('.ant-tree-node-selected')?.scrollIntoView({ block: 'nearest' });
  }, [value]);
  return <div className="browser-bookmark-destination">
    <span>{label}</span>
    <div ref={container} className="browser-bookmark-folder-tree" style={{
      borderColor: token.colorBorder, borderRadius: token.borderRadius,
    }}>
      <Tree treeData={tree} aria-label={label} blockNode showIcon defaultExpandAll icon={<Folder size="1em" />}
        selectedKeys={[value || BAR_KEY]} onSelect={keys => {
          const key = keys[0];
          if (typeof key === 'string') onChange(key === BAR_KEY ? '' : key);
        }} />
    </div>
  </div>;
}
