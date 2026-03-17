'use client';

import { ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import type { DocFolder } from '@/types/docs';

interface Props {
  folders: DocFolder[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function FolderNode({
  folder,
  selectedId,
  onSelect,
  depth,
}: {
  folder: DocFolder;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = (folder.children?.length ?? 0) > 0;
  const isSelected = selectedId === folder.id;

  return (
    <div>
      <button
        onClick={() => {
          onSelect(isSelected ? null : folder.id);
          if (hasChildren) setOpen((o) => !o);
        }}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors
          ${isSelected ? 'bg-indigo-600/30 text-indigo-300' : 'text-gray-300 hover:bg-gray-800'}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {hasChildren ? (
          <ChevronRight
            className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          />
        ) : (
          <span className="w-3.5" />
        )}
        {open ? (
          <FolderOpen className="w-4 h-4 shrink-0 text-indigo-400" />
        ) : (
          <Folder className="w-4 h-4 shrink-0 text-indigo-400" />
        )}
        <span className="truncate">{folder.name}</span>
      </button>
      {open && hasChildren && (
        <div>
          {folder.children!.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FolderTree({ folders, selectedId, onSelect }: Props) {
  return (
    <nav className="space-y-0.5">
      <button
        onClick={() => onSelect(null)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors
          ${selectedId === null ? 'bg-indigo-600/30 text-indigo-300' : 'text-gray-300 hover:bg-gray-800'}`}
      >
        <Folder className="w-4 h-4 text-indigo-400" />
        All Documents
      </button>
      {folders.map((f) => (
        <FolderNode key={f.id} folder={f} selectedId={selectedId} onSelect={onSelect} depth={0} />
      ))}
    </nav>
  );
}
