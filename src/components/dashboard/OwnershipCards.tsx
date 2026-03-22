'use client';

import { TrendingUp, Zap, Target, Award, PieChart } from 'lucide-react';
import StatsCard from './StatsCard';

interface OwnershipData {
  vested: number;
  provisional: number;
  multiplier: number;
  effective: number;
  normalizedOwnershipPct?: number;
  contributionScore?: number;
  totalSystemScore?: number;
  contributorPoolPct?: number;
}

interface OwnershipCardsProps {
  data: OwnershipData;
}

export default function OwnershipCards({ data }: OwnershipCardsProps) {
  const ownershipData = data;

  const formatPercentage = (value: number) => {
    if (value === 0) return '0';
    if (value < 0.01) return '<0.01';
    return value.toFixed(2);
  };

  const formatMultiplier = (value: number) => value.toFixed(1);

  const hasNormalized = ownershipData.normalizedOwnershipPct !== undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Vested Ownership"
          value={`${formatPercentage(ownershipData.vested)}%`}
          icon={TrendingUp}
          highlightColor="bg-blue-500"
          subtitle="Locked & earned"
        />

        <StatsCard
          title="Provisional Ownership"
          value={`${formatPercentage(ownershipData.provisional)}%`}
          icon={Zap}
          highlightColor="bg-violet-500"
          subtitle="Pending vesting"
        />

        <StatsCard
          title="Multiplier"
          value={`${formatMultiplier(ownershipData.multiplier)}x`}
          icon={Target}
          highlightColor="bg-yellow-500"
          subtitle="Activity factor"
        />

        <div
          className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 
            rounded-2xl p-6 border border-green-800/50 
            hover:shadow-xl hover:shadow-green-500/10 hover:-translate-y-1 
            transition-all duration-300 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <span className="text-sm text-gray-400 font-medium">Effective Ownership</span>
              <div className="p-2 rounded-lg bg-green-500/10">
                <Award className="w-5 h-5 text-green-500" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold text-green-400 group-hover:text-green-300 transition-colors">
                {formatPercentage(ownershipData.effective)}%
              </p>
              <p className="text-sm text-gray-500">Total stake</p>
            </div>
          </div>
        </div>
      </div>

      {/* Normalized ownership row — only shown when economy engine data is available */}
      {hasNormalized && (
        <div
          className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 
            rounded-2xl p-6 border border-indigo-800/50 
            hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 
            transition-all duration-300 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <PieChart className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400 font-medium">Normalized Ownership</p>
                <p className="text-xs text-gray-500">
                  Contributor pool ({((ownershipData.contributorPoolPct ?? 0.4) * 100).toFixed(0)}%) · score-weighted
                </p>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-400">
                  {formatPercentage(ownershipData.normalizedOwnershipPct ?? 0)}%
                </p>
                <p className="text-xs text-gray-500">of total pool</p>
              </div>
              {ownershipData.contributionScore !== undefined && (
                <div className="text-center">
                  <p className="text-lg font-semibold text-purple-400">
                    {ownershipData.contributionScore.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">your score</p>
                </div>
              )}
              {ownershipData.totalSystemScore !== undefined && ownershipData.totalSystemScore > 0 && (
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-300">
                    {ownershipData.totalSystemScore.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">system total</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
