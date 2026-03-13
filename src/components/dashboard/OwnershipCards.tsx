'use client';

import { TrendingUp, Zap, Target, Award } from 'lucide-react';
import StatsCard from './StatsCard';

interface OwnershipData {
  vested: number;
  provisional: number;
  multiplier: number;
  effective: number;
}

interface OwnershipCardsProps {
  data: OwnershipData;
}

export default function OwnershipCards({ data }: OwnershipCardsProps) {
  const ownershipData = data;

  // Format numbers to reasonable precision
  const formatPercentage = (value: number) => {
    if (value === 0) return '0';
    if (value < 0.01) return '<0.01';
    return value.toFixed(2);
  };

  const formatMultiplier = (value: number) => {
    return value.toFixed(1);
  };

  return (
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
  );
}
