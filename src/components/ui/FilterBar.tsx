'use client';

import { X } from 'lucide-react';
import type { FilterState } from '@/hooks/useFilters';

interface FilterBarProps {
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
  showType?: boolean;
  typeOptions?: { value: string; label: string }[];
  showStatus?: boolean;
  statusOptions?: { value: string; label: string }[];
  showUser?: boolean;
  showSearch?: boolean;
}

export default function FilterBar({
  filters,
  setFilter,
  resetFilters,
  hasActiveFilters,
  showType = true,
  typeOptions = [],
  showStatus = false,
  statusOptions = [],
  showUser = false,
  showSearch = false,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-900 border border-gray-800 rounded-xl">
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400">From</label>
        <input
          type="date"
          value={filters.startDate}
          onChange={e => setFilter('startDate', e.target.value)}
          className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400">To</label>
        <input
          type="date"
          value={filters.endDate}
          onChange={e => setFilter('endDate', e.target.value)}
          className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      {showType && typeOptions.length > 0 && (
        <select
          value={filters.type}
          onChange={e => setFilter('type', e.target.value)}
          className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All types</option>
          {typeOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {showStatus && statusOptions.length > 0 && (
        <select
          value={filters.status}
          onChange={e => setFilter('status', e.target.value)}
          className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All statuses</option>
          {statusOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {showUser && (
        <input
          type="text"
          placeholder="User ID..."
          value={filters.userId}
          onChange={e => setFilter('userId', e.target.value)}
          className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40"
        />
      )}
      {showSearch && (
        <input
          type="text"
          placeholder="Search..."
          value={filters.search}
          onChange={e => setFilter('search', e.target.value)}
          className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40"
        />
      )}
      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          <X className="w-3 h-3" /> Clear
        </button>
      )}
    </div>
  );
}
