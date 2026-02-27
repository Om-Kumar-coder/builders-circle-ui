'use client';

import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  highlightColor: string;
  subtitle?: string;
}

export default function StatsCard({
  title,
  value,
  icon: Icon,
  highlightColor,
  subtitle,
}: StatsCardProps) {
  return (
    <div
      className="bg-gray-900 rounded-2xl p-6 border border-gray-800 
        hover:shadow-xl hover:-translate-y-1 transition-all duration-300 
        hover:border-gray-700 group"
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-sm text-gray-400 font-medium">{title}</span>
        <div className={`p-2 rounded-lg ${highlightColor} bg-opacity-10`}>
          <Icon className={`w-5 h-5 ${highlightColor.replace('bg-', 'text-')}`} />
        </div>
      </div>
      
      <div className="space-y-1">
        <p className="text-3xl font-bold text-gray-100 group-hover:text-white transition-colors">
          {value}
        </p>
        {subtitle && (
          <p className="text-sm text-gray-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
