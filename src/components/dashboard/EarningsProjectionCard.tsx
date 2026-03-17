'use client';

import { TrendingUp, DollarSign, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface EarningsProjectionProps {
  vestedOwnership: number;
  provisionalOwnership: number;
  multiplier: number;
  effectiveOwnership: number;
  totalCycleValue?: number;
}

export default function EarningsProjectionCard({
  vestedOwnership,
  provisionalOwnership,
  multiplier,
  effectiveOwnership,
  totalCycleValue = 0,
}: EarningsProjectionProps) {
  const estimatedEarnings = effectiveOwnership * totalCycleValue;
  const provisionalContribution = provisionalOwnership * multiplier;

  const chartData = [
    { name: 'Vested', value: vestedOwnership, color: '#3b82f6' },
    { name: 'Provisional', value: provisionalOwnership, color: '#f59e0b' },
    { name: 'Multiplier Effect', value: provisionalContribution - provisionalOwnership, color: '#8b5cf6' },
    { name: 'Effective Total', value: effectiveOwnership, color: '#6366f1' },
  ];

  const fmt = (n: number) => n < 0.01 && n > 0 ? '<0.01' : n.toFixed(2);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-gray-100">Earnings Projection</h2>
        </div>
        <div className="group relative">
          <Info className="w-4 h-4 text-gray-500 cursor-help" />
          <div className="absolute right-0 top-6 w-64 p-3 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hidden group-hover:block z-10 shadow-xl">
            <p className="font-semibold mb-1">Formula:</p>
            <p>effectiveOwnership = vested + (provisional × multiplier)</p>
            <p className="mt-1">estimatedEarnings = effectiveOwnership × cyclePoolValue</p>
          </div>
        </div>
      </div>

      {/* Estimated Earnings */}
      <div className="flex items-center gap-4 p-4 bg-indigo-900/20 border border-indigo-800/40 rounded-xl">
        <div className="p-3 bg-indigo-500/10 rounded-lg">
          <DollarSign className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <p className="text-sm text-gray-400">Estimated Earnings (current cycle)</p>
          <p className="text-2xl font-bold text-indigo-400">
            {totalCycleValue > 0 ? `$${estimatedEarnings.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `${fmt(effectiveOwnership)}% of pool`}
          </p>
          {totalCycleValue > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">Based on {fmt(effectiveOwnership)}% effective ownership × ${totalCycleValue.toLocaleString()} pool</p>
          )}
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-400">Ownership Breakdown</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between p-2.5 bg-gray-800/50 rounded-lg">
            <span className="text-gray-400">Vested</span>
            <span className="text-blue-400 font-medium">{fmt(vestedOwnership)}%</span>
          </div>
          <div className="flex justify-between p-2.5 bg-gray-800/50 rounded-lg">
            <span className="text-gray-400">Provisional</span>
            <span className="text-yellow-400 font-medium">{fmt(provisionalOwnership)}%</span>
          </div>
          <div className="flex justify-between p-2.5 bg-gray-800/50 rounded-lg">
            <span className="text-gray-400">Multiplier</span>
            <span className="text-purple-400 font-medium">{multiplier.toFixed(2)}×</span>
          </div>
          <div className="flex justify-between p-2.5 bg-indigo-900/20 border border-indigo-800/30 rounded-lg">
            <span className="text-gray-300 font-medium">Effective</span>
            <span className="text-indigo-400 font-bold">{fmt(effectiveOwnership)}%</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Ownership composition</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem', color: '#e5e7eb', fontSize: 12 }}
              formatter={(v: number) => [`${v.toFixed(3)}%`, '']}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
