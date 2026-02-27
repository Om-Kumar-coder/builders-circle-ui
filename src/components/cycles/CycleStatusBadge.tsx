'use client';

import type { CycleState } from '@/types/cycle';

interface CycleStatusBadgeProps {
  state: CycleState;
  className?: string;
}

const stateConfig = {
  planned: {
    label: 'Planned',
    className: 'bg-gray-100 text-gray-700 border-gray-300',
  },
  active: {
    label: 'Active',
    className: 'bg-green-100 text-green-700 border-green-300',
  },
  paused: {
    label: 'Paused',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  },
  closed: {
    label: 'Closed',
    className: 'bg-red-100 text-red-700 border-red-300',
  },
};

export default function CycleStatusBadge({ state, className = '' }: CycleStatusBadgeProps) {
  const config = stateConfig[state];

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}
