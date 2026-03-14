'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { BuildCycle } from '@/types/cycle';
import CycleStatusBadge from './CycleStatusBadge';
import JoinBuildButton from '../participation/JoinBuildButton';
import ParticipationBadge from '../participation/ParticipationBadge';
import { useParticipation } from '@/hooks/useParticipation';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import { Play, Pause, Lock } from 'lucide-react';

interface CycleCardProps {
  cycle: BuildCycle;
  userId?: string;
}

export default function CycleCard({ cycle, userId }: CycleCardProps) {
  const { user } = useAuth();
  const { participation, refetch } = useParticipation(userId, cycle.id);
  const [cycleState, setCycleState] = useState(cycle.state);
  const [stateLoading, setStateLoading] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'founder';
  const showButton = cycleState === 'active' && !participation && !!userId;

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

  const handleStateChange = async (newState: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setStateLoading(true);
      await apiClient.updateCycle(cycle.id, { state: newState });
      setCycleState(newState as BuildCycle['state']);
    } catch (err) {
      console.error('Failed to update cycle state:', err);
    } finally {
      setStateLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-200 group">
      <Link href={`/build-cycles/${cycle.id}`} className="block mb-4">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-100 group-hover:text-indigo-400 transition-colors">
            {cycle.name}
          </h3>
          <CycleStatusBadge state={cycleState} />
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
        <div className="flex items-center justify-between mb-3">
          {participation ? (
            <>
              <span className="text-sm text-gray-400">Your Status:</span>
              <ParticipationBadge participation={participation} size="sm" />
            </>
          ) : showButton ? (
            <JoinBuildButton
              userId={userId!}
              cycleId={cycle.id}
              onSuccess={handleJoinSuccess}
              className="w-full justify-center"
            />
          ) : (
            <div className="text-center text-sm text-gray-500 w-full">
              {cycle.state !== 'active' ? 'Not active' : 'View details to join'}
            </div>
          )}
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-2">
          <Link
            href={`/build-cycles/${cycle.id}/overview`}
            className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-gray-100 
              text-sm rounded-lg transition-colors text-center"
          >
            Overview
          </Link>
          <Link
            href={`/build-cycles/${cycle.id}`}
            className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white 
              text-sm rounded-lg transition-colors text-center"
          >
            Details
          </Link>
        </div>

        {/* Admin State Controls */}
        {isAdmin && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-800">
            {cycleState !== 'active' && cycleState !== 'closed' && (
              <button
                onClick={(e) => handleStateChange('active', e)}
                disabled={stateLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
              >
                <Play className="w-3 h-3" />
                {cycleState === 'paused' ? 'Resume' : 'Activate'}
              </button>
            )}
            {cycleState === 'active' && (
              <button
                onClick={(e) => handleStateChange('paused', e)}
                disabled={stateLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
              >
                <Pause className="w-3 h-3" />
                Pause
              </button>
            )}
            {cycleState !== 'closed' && (
              <button
                onClick={(e) => {
                  if (confirm('Close this cycle?')) handleStateChange('closed', e);
                  else e.preventDefault();
                }}
                disabled={stateLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
              >
                <Lock className="w-3 h-3" />
                Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
