import { useState, useMemo } from 'react';
import type { WorkspaceFileNode } from '@shared/ipc';

export interface FileTreeProps {
  readonly files: readonly WorkspaceFileNode[];
  readonly activeFilePath?: string | null;
  readonly modifiedFiles?: readonly string[];
  readonly onSelectFile: (filePath: string) => void;
  readonly onRefresh?: () => void;
  readonly projectName?: string;
  readonly isCollapsed?: boolean;
  readonly onToggleCollapse?: () => void;
}

function getFileIcon(fileName: string, isDirectory: boolean, isOpen: boolean): string {
  if (isDirectory) {
    return isOpen ? '📂' : '📁';
  }
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return '🟦';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return '🟨';
    case 'json':
      return '🧾';
    case 'html':
      return '🌐';
    case 'css':
    case 'scss':
      return '🎨';
    case 'md':
      return '📝';
    case 'yml':
    case 'yaml':
      return '⚙️';
    case 'png':
    case 'jpg':
    case 'svg':
      return '🖼️';
    default:
      return '📄';
  }
}

interface FileTreeNodeProps {
  readonly node: WorkspaceFileNode;
  readonly level: number;
  readonly activeFilePath?: string | null;
  readonly modifiedFiles?: readonly string[];
  readonly openFolders: Set<string>;
  readonly onToggleFolder: (path: string) => void;
  readonly onSelectFile: (path: string) => void;
}

function FileTreeNodeItem({
  node,
  level,
  activeFilePath,
  modifiedFiles,
  openFolders,
  onToggleFolder,
  onSelectFile,
}: FileTreeNodeProps): React.JSX.Element {
  const isOpen = openFolders.has(node.path);
  const isActive = activeFilePath === node.path;
  const isModified = modifiedFiles?.includes(node.path);

  if (node.isDirectory) {
    return (
      <div className="flex flex-col select-none">
        <button
          type="button"
          onClick={() => onToggleFolder(node.path)}
          style={{ paddingLeft: `${Math.max(8, level * 14)}px` }}
          className={`flex items-center gap-1.5 py-1 pr-2 text-[12.5px] font-mono rounded hover:bg-surface-2 transition-colors text-left cursor-pointer text-muted hover:text-text group`}
        >
          <span
            className={`text-[10px] w-3 text-center transition-transform duration-150 inline-block ${
              isOpen ? 'rotate-90' : ''
            }`}
          >
            ▶
          </span>
          <span className="text-sm">{getFileIcon(node.name, true, isOpen)}</span>
          <span className="truncate font-medium">{node.name}</span>
        </button>

        {isOpen && node.children && node.children.length > 0 && (
          <div className="flex flex-col">
            {node.children.map((child) => (
              <FileTreeNodeItem
                key={child.path}
                node={child}
                level={level + 1}
                activeFilePath={activeFilePath}
                modifiedFiles={modifiedFiles}
                openFolders={openFolders}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelectFile(node.path)}
      style={{ paddingLeft: `${Math.max(16, level * 14 + 14)}px` }}
      className={`flex items-center gap-2 py-1 pr-2 text-[12.5px] font-mono rounded transition-colors text-left cursor-pointer group ${
        isActive
          ? 'bg-primary-soft text-primary-ink font-semibold'
          : 'hover:bg-surface-2 text-text/90 hover:text-text'
      }`}
    >
      <span className="text-xs flex-none">{getFileIcon(node.name, false, false)}</span>
      <span className="truncate flex-1">{node.name}</span>
      {isModified && (
        <span
          title="File đã được sửa đổi"
          className="w-1.5 h-1.5 rounded-full bg-primary flex-none"
        />
      )}
    </button>
  );
}

export function FileTree({
  files,
  activeFilePath,
  modifiedFiles = [],
  onSelectFile,
  onRefresh,
  projectName = 'DỰ ÁN',
  isCollapsed = false,
  onToggleCollapse,
}: FileTreeProps): React.JSX.Element {
  const [openFolders, setOpenFolders] = useState<Set<string>>(() => {
    // Mở sẵn các folder cấp 1 phổ biến
    const initial = new Set<string>();
    files.forEach((f) => {
      if (f.isDirectory && (f.name === 'src' || f.name === 'spikes' || f.name === 'Document')) {
        initial.add(f.path);
      }
    });
    return initial;
  });

  const [search, setSearch] = useState('');

  const handleToggleFolder = (path: string): void => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const filteredFiles = useMemo(() => {
    if (!search.trim()) return files;
    const q = search.toLowerCase();

    function filterNode(node: WorkspaceFileNode): WorkspaceFileNode | null {
      if (!node.isDirectory) {
        return node.name.toLowerCase().includes(q) ? node : null;
      }
      if (!node.children) return null;
      const matchedChildren: WorkspaceFileNode[] = [];
      for (const child of node.children) {
        const res = filterNode(child);
        if (res) matchedChildren.push(res);
      }
      if (matchedChildren.length > 0 || node.name.toLowerCase().includes(q)) {
        return { ...node, children: matchedChildren };
      }
      return null;
    }

    const res: WorkspaceFileNode[] = [];
    for (const f of files) {
      const filtered = filterNode(f);
      if (filtered) res.push(filtered);
    }
    return res;
  }, [files, search]);

  if (isCollapsed) {
    return (
      <aside className="w-10 bg-surface border-l border-border flex flex-col items-center py-3 select-none">
        <button
          type="button"
          title="Mở rộng File Explorer"
          aria-label="Mở rộng File Explorer"
          onClick={onToggleCollapse}
          className="p-1.5 rounded hover:bg-surface-2 text-muted hover:text-text cursor-pointer"
        >
          📁
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 lg:w-72 flex-none bg-surface border-l border-border flex flex-col overflow-hidden select-none">
      {/* Header cây thư mục */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-surface-2/40">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="text-xs">📂</span>
          <span className="text-xs font-bold tracking-wider uppercase text-muted truncate">
            {projectName}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <button
              type="button"
              title="Làm mới cây thư mục"
              onClick={onRefresh}
              className="p-1 rounded text-muted hover:text-text hover:bg-surface-2 cursor-pointer text-xs"
            >
              🔄
            </button>
          )}
          {onToggleCollapse && (
            <button
              type="button"
              title="Thu gọn"
              onClick={onToggleCollapse}
              className="p-1 rounded text-muted hover:text-text hover:bg-surface-2 cursor-pointer text-xs"
            >
              ⇤
            </button>
          )}
        </div>
      </div>

      {/* Tìm kiếm file nhanh */}
      <div className="p-2 border-b border-line bg-surface">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm file..."
          className="w-full px-2.5 py-1 text-[12px] font-mono bg-surface-2 border border-border rounded text-text placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Cây thư mục */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
        {filteredFiles.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted">Không tìm thấy file nào</div>
        ) : (
          filteredFiles.map((node) => (
            <FileTreeNodeItem
              key={node.path}
              node={node}
              level={0}
              activeFilePath={activeFilePath}
              modifiedFiles={modifiedFiles}
              openFolders={openFolders}
              onToggleFolder={handleToggleFolder}
              onSelectFile={onSelectFile}
            />
          ))
        )}
      </div>
    </aside>
  );
}
