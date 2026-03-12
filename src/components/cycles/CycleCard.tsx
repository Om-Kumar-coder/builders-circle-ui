'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { BuildCycle } from '@/types/cycle';
import CycleStatusBadge from './CycleStatusBadge';
import JoinBuildButton from '../participation/JoinBuildButton';
import ParticipationBadge from '../participation/ParticipationBadge';
import { useParticipation } from '@/hooks/useParticipation';

interface CycleCardProps {
  cycle: BuildCycle;
  userId?: string;
}

export default function CycleCard({ cycle, userId }: CycleCardProps) {
  const { participation, refetch } = useParticipation(userId, cycle.id);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    // Show button only if cycle is active and user is not participating
    setShowButton(cycle.state === 'active' && !participation && !!userId);
  }, [cycle.state, participation, userId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleJoinSuccess = () => {
    refetch();
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-200 group">
      <Link href={`/build-cycles/${cycle.id}`} className="block mb-4">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-100 group-hover:text-indigo-400 transition-colors">
            {cycle.name}
          </h3>
          <CycleStatusBadge state={cycle.state} />
        </div>

        {/* Description */}
        {cycle.description && (
          <p className="text-gray-400 text-sm mb-4 line-clamp-2">
            {cycle.description}
          </p>
        )}

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
            <span className="font-semibold text-gray-100">{cycle.participantCount || 0}</span>
          </div>
        </div>
      </Link>

      {/* Participation Status */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        {participation ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Your Status:</span>
            <ParticipationBadge participation={participation} size="sm" />
          </div>
        ) : showButton ? (
          <JoinBuildButton
            userId={userId!}
            cycleId={cycle.id}
            onSuccess={handleJoinSuccess}
            className="w-full justify-center"
          />
        ) : (
          <div className="text-center text-sm text-gray-500">
            {cycle.state !== 'active' ? 'Not active' : 'View details to join'}
          </div>
        )}
      </div>
    </div>
  );
}
