'use client';

import { useState } from 'react';
import type { BuildCycle, CycleState } from '@/types/cycle';
import type { User } from '@/types/auth';
import type { ParticipationRecord } from '@/lib/participation';
import CycleStatusBadge from './CycleStatusBadge';
import ParticipationBadge from '../participation/ParticipationBadge';
import StallStageIndicator from '../participation/StallStageIndicator';
import JoinBuildButton from '../participation/JoinBuildButton';
import { databases } from '@/lib/appwrite';

interface CycleDetailsProps {
  cycle: BuildCycle;
  user: User;
  participation: ParticipationRecord | null;
  onUpdate: () => void;
}

const stateTransitions: Record<CycleState, CycleState[]> = {
  planned: ['active'],
  active: ['paused', 'closed'],
  paused: ['active'],
  closed: [],
};

export default function CycleDetails({ cycle, user, participation, onUpdate }: CycleDetailsProps) {
  const [loading, setLoading] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const isAdmin = user.role === 'admin' || user.role === 'founder';
  const canTransition = stateTransitions[cycle.state];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'No activity yet';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleStateChange = async (newState: CycleState) => {
    if (newState === 'closed' && !confirmClose) {
      setConfirmClose(true);
      return;
    }

    setLoading(true);
    try {
      await databases.updateDocument(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '',
        process.env.NEXT_PUBLIC_APPWRITE_CYCLES_COLLECTION_ID || '',
        cycle.$id,
        {
          state: newState,
          // Don't set updatedAt - Appwrite handles $updatedAt automatically
        }
      );
      setConfirmClose(false);
      onUpdate();
    } catch (error) {
      console.error('Failed to update cycle state:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cycle Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-100 mb-2">{cycle.name}</h1>
            <CycleStatusBadge state={cycle.state} className="text-base px-4 py-1.5" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Start Date</p>
            <p className="text-lg font-semibold text-gray-100">{formatDate(cycle.startDate)}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">End Date</p>
            <p className="text-lg font-semibold text-gray-100">{formatDate(cycle.endDate)}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Participants</p>
            <p className="text-lg font-semibold text-gray-100">{cycle.participantCount || 0}</p>
          </div>
        </div>
      </div>

      {/* Admin Controls */}
      {isAdmin && canTransition.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Admin Controls</h2>
          
          {confirmClose ? (
            <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4">
              <p className="text-yellow-400 mb-4">
                Are you sure you want to close this cycle? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmClose(false)}
                  className="px-4 py-2 border border-gray-700 rounded-md text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleStateChange('closed')}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Closing...' : 'Confirm Close'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {canTransition.includes('active') && (
                <button
                  onClick={() => handleStateChange('active')}
                  disabled={loading}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Activate Cycle'}
                </button>
              )}
              {canTransition.includes('paused') && (
                <button
                  onClick={() => handleStateChange('paused')}
                  disabled={loading}
                  className="px-6 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Pause Cycle'}
                </button>
              )}
              {canTransition.includes('closed') && (
                <button
                  onClick={() => handleStateChange('closed')}
                  disabled={loading}
                  className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Close Cycle'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* User Participation */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Your Participation</h2>
        
        {participation ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">✔</span>
              <div>
                <p className="text-lg font-medium text-green-400">You are participating in this cycle</p>
                <p className="text-sm text-gray-400">Accountability tracking is active</p>
              </div>
            </div>
            
            {/* Stall Stage Indicator */}
            <div className="mt-4">
              <StallStageIndicator participation={participation} showDetails={true} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Last Activity</p>
                <p className="text-base font-medium text-gray-200">
                  {formatDateTime(participation.lastActivityDate)}
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Participation Status</p>
                <ParticipationBadge participation={participation} size="md" />
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Joined</p>
                <p className="text-base font-medium text-gray-200">
                  {formatDate(participation.$createdAt)}
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Cycle Progress</p>
                <p className="text-base font-medium text-gray-200">
                  Active
                </p>
              </div>
            </div>

            {participation.stallStage === 'paused' && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">
                  <strong>Action Required:</strong> Your participation is paused due to inactivity. Submit activity to resume.
                </p>
              </div>
            )}

            {participation.stallStage === 'grace' && (
              <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-400">
                  <strong>Grace Period:</strong> You have time to make your first contribution before accountability tracking begins.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-5xl mb-4 opacity-50">🚀</div>
            <p className="text-gray-400 mb-2">You are not currently participating in this cycle.</p>
            <p className="text-sm text-gray-500 mb-6">
              Join to activate accountability tracking and start building!
            </p>
            {cycle.state === 'active' ? (
              <JoinBuildButton
                userId={user.$id}
                cycleId={cycle.$id}
                onSuccess={onUpdate}
                className="mx-auto"
              />
            ) : (
              <p className="text-sm text-gray-500">This cycle is not currently active.</p>
            )}
          </div>
        )}
      </div>

      {/* Activity Summary */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Activity Summary</h2>
        <div className="text-gray-400 space-y-2">
          <div className="flex justify-between">
            <span>Cycle created:</span>
            <span className="text-gray-300">{formatDateTime(cycle.$createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Last updated:</span>
            <span className="text-gray-300">{formatDateTime(cycle.$updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
