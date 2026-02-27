'use client';

import type { ParticipationRecord } from '@/lib/participation';
import { Activity, AlertTriangle, Pause, Clock } from 'lucide-react';

interface ParticipationBadgeProps {
  participation: ParticipationRecord;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const statusConfig = {
  grace: {
    label: 'Grace Period',
    icon: Clock,
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  },
  active: {
    label: 'Active',
    icon: Activity,
    className: 'bg-green-500/10 text-green-400 border-green-500/30',
  },
  'at-risk': {
    label: 'At Risk',
    icon: AlertTriangle,
    className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  },
  paused: {
    label: 'Paused',
    icon: Pause,
    className: 'bg-red-500/10 text-red-400 border-red-500/30',
  },
};

const sizeConfig = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};

export default function ParticipationBadge({
  participation,
  size = 'md',
  showIcon = true,
}: ParticipationBadgeProps) {
  const config = statusConfig[participation.participationStatus];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${config.className} ${sizeConfig[size]}`}
    >
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />}
      {config.label}
    </span>
  );
}
