'use client';

import { Crown, Star, Zap, User, Eye } from 'lucide-react';

export type Tier = 'founder' | 'core' | 'contributor' | 'observer' | 'employee';

interface TierConfig {
  label: string;
  icon: React.ElementType;
  bg: string;
  text: string;
  border: string;
  description: string;
}

const TIER_CONFIG: Record<Tier, TierConfig> = {
  founder: {
    label: 'Founder',
    icon: Crown,
    bg: 'bg-amber-900/30',
    text: 'text-amber-300',
    border: 'border-amber-700/50',
    description: 'Full platform access & governance rights',
  },
  core: {
    label: 'Core Contributor',
    icon: Star,
    bg: 'bg-indigo-900/30',
    text: 'text-indigo-300',
    border: 'border-indigo-700/50',
    description: 'Significant ownership stake & voting weight',
  },
  contributor: {
    label: 'Contributor',
    icon: Zap,
    bg: 'bg-violet-900/30',
    text: 'text-violet-300',
    border: 'border-violet-700/50',
    description: 'Active participant earning ownership',
  },
  employee: {
    label: 'Employee',
    icon: User,
    bg: 'bg-blue-900/30',
    text: 'text-blue-300',
    border: 'border-blue-700/50',
    description: 'Salaried team member',
  },
  observer: {
    label: 'Observer',
    icon: Eye,
    bg: 'bg-gray-800/60',
    text: 'text-gray-400',
    border: 'border-gray-700/50',
    description: 'Read-only access',
  },
};

/** Derive tier from role + effective ownership % */
export function deriveTier(role?: string, effectiveOwnership?: number): Tier {
  if (role === 'founder') return 'founder';
  if (role === 'employee') return 'employee';
  if (role === 'observer') return 'observer';
  // admin or contributor — use ownership to distinguish core vs regular
  const pct = effectiveOwnership ?? 0;
  if (pct >= 1) return 'core';
  return 'contributor';
}

interface TierBadgeProps {
  tier: Tier;
  size?: 'sm' | 'md' | 'lg';
  showDescription?: boolean;
}

const sizeMap = {
  sm: { wrap: 'px-2 py-1 text-xs gap-1', icon: 'w-3 h-3' },
  md: { wrap: 'px-3 py-1.5 text-sm gap-1.5', icon: 'w-4 h-4' },
  lg: { wrap: 'px-4 py-2 text-base gap-2', icon: 'w-5 h-5' },
};

export default function TierBadge({ tier, size = 'md', showDescription = false }: TierBadgeProps) {
  const cfg = TIER_CONFIG[tier];
  const sz = sizeMap[size];
  const Icon = cfg.icon;

  if (showDescription) {
    return (
      <div className={`inline-flex flex-col gap-1 rounded-xl border p-3 ${cfg.bg} ${cfg.border}`}>
        <div className={`flex items-center ${sz.wrap} font-semibold ${cfg.text}`}>
          <Icon className={sz.icon} />
          {cfg.label}
        </div>
        <p className="text-xs text-gray-400 pl-1">{cfg.description}</p>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${sz.wrap} ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <Icon className={sz.icon} />
      {cfg.label}
    </span>
  );
}
