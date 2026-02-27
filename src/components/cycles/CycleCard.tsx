'use client';

import Link from 'next/link';
import type { BuildCycle } from '@/types/cycle';
import CycleStatusBadge from './CycleStatusBadge';

interface CycleCardProps {
  cycle: BuildCycle;
}

export default function CycleCard({ cycle }: CycleCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Link href={`/build-cycles/${cycle.$id}`}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-200 cursor-pointer group">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-100 group-hover:text-indigo-400 transition-colors">
            {cycle.name}
          </h3>
          <CycleStatusBadge state={cycle.state} />
        </div>

        <div className="space-y-2 text-sm text-gray-400">
          <div className="flex items-center justify-between">
            <span className="font-medium">Start Date:</span>
            <span className="text-gray-300">{formatDate(cycle.startDate)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">End Date:</span>
            <span className="text-gray-300">{formatDate(cycle.endDate)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Participants:</span>
            <span className="font-semibold text-gray-100">{cycle.participantCount}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
