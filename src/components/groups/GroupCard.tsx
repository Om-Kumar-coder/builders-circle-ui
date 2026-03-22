'use client';

import { Users, Star } from 'lucide-react';
import type { Group } from '@/hooks/useGroups';

interface GroupCardProps {
  group: Group;
  onEdit?: (group: Group) => void;
  onDelete?: (group: Group) => void;
}

export default function GroupCard({ group, onEdit, onDelete }: GroupCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-base font-semibold text-gray-100 truncate">{group.name}</h3>
          {group.isDefault && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-800/40">
              <Star size={10} /> Default
            </span>
          )}
        </div>
        {group.description && (
          <p className="text-sm text-gray-400 mb-2 line-clamp-2">{group.description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Users size={12} />
            {group._count?.users ?? 0} member{(group._count?.users ?? 0) !== 1 ? 's' : ''}
          </span>
          <span>{group._count?.tasks ?? 0} task{(group._count?.tasks ?? 0) !== 1 ? 's' : ''}</span>
        </div>
      </div>
      {(onEdit || onDelete) && (
        <div className="flex gap-2 shrink-0">
          {onEdit && (
            <button
              onClick={() => onEdit(group)}
              className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(group)}
              className="px-3 py-1.5 text-xs bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
