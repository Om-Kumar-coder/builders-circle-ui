/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { useParticipation } from '@/hooks/useParticipation';
import CycleStatusBadge from './CycleStatusBadge';
import JoinBuildButton from '../participation/JoinBuildButton';
import ParticipationBadge from '../participation/ParticipationBadge';
import { Calendar, Users, Activity, Play, Pause, Lock, RotateCcw, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface CycleDetailsProps {
  cycle: any;
  userId?: string;
}

export default function CycleDetails({ cycle, userId }: CycleDetailsProps) {
  const { user } = useAuth();
  const { participation, refetch } = useParticipation(userId, cycle.id);
  const [activities, setActivities] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycleState, setCycleState] = useState(cycle.state);
  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'founder';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [activitiesData, participantsData] = await Promise.all([
          apiClient.getActivities(cycle.id).catch(() => []),
          apiClient.getTeamMembers(cycle.id).catch(() => [])
        ]);
        setActivities(activitiesData);
        setParticipants(participantsData);
      } catch (error) {
        console.error('Error fetching cycle details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [cycle.id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleJoinSuccess = () => {
    refetch();
  };

  const handleStateChange = async (newState: string) => {
    try {
      setStateLoading(true);
      setStateError(null);
      await apiClient.updateCycle(cycle.id, { state: newState });
      setCycleState(newState);
    } catch (err) {
      setStateError(err instanceof Error ? err.message : 'Failed to update cycle state');
    } finally {
      setStateLoading(false);
    }
  };

  const isActive = cycleState === 'active';
  const canJoin = isActive && !participation && userId;

  return (
    <div className="space-y-6">
      {/* Cycle Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-3xl font-bold text-gray-100">{cycle.name}</h1>
              <CycleStatusBadge state={cycleState} />
            </div>
            {cycle.description && (
              <p className="text-gray-400 text-lg">{cycle.description}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Start Date</p>
              <p className="text-gray-100 font-semibold">{formatDate(cycle.startDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <Calendar className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">End Date</p>
              <p className="text-gray-100 font-semibold">{formatDate(cycle.endDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Participants</p>
              <p className="text-gray-100 font-semibold">{cycle.participantCount || 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Activities</p>
              <p className="text-gray-100 font-semibold">{activities.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Cycle Controls */}
      {isAdmin && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-1">Admin Controls</h2>
          <p className="text-sm text-gray-400 mb-4">Manage cycle state and participant stall delays</p>

          {stateError && (
            <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-2 rounded-lg mb-4 text-sm">
              {stateError}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {cycleState !== 'active' && cycleState !== 'closed' && (
              <button
                onClick={() => handleStateChange('active')}
                disabled={stateLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
              >
                <Play className="w-4 h-4" />
                Activate Cycle
              </button>
            )}
            {cycleState === 'active' && (
              <button
                onClick={() => handleStateChange('paused')}
                disabled={stateLoading}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
              >
                <Pause className="w-4 h-4" />
                Pause Cycle
              </button>
            )}
            {cycleState === 'paused' && (
              <button
                onClick={() => handleStateChange('active')}
                disabled={stateLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
              >
                <Play className="w-4 h-4" />
                Resume Cycle
              </button>
            )}
            {cycleState !== 'closed' && (
              <button
                onClick={() => {
                  if (confirm('Close this cycle? This will finalize all participation records.')) {
                    handleStateChange('closed');
                  }
                }}
                disabled={stateLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
              >
                <Lock className="w-4 h-4" />
                Close Cycle
              </button>
            )}
            {cycleState === 'closed' && (
              <button
                onClick={() => handleStateChange('planned')}
                disabled={stateLoading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
              >
                <RotateCcw className="w-4 h-4" />
                Reopen as Planned
              </button>
            )}
            <a
              href="/admin/overrides"
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors text-sm font-medium"
            >
              <Clock className="w-4 h-4" />
              Stall Delay Overrides
            </a>
          </div>

          {stateLoading && (
            <p className="text-sm text-gray-400 mt-3 flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Updating cycle state...
            </p>
          )}
        </div>
      )}

      {/* Participation Status */}
      {userId && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Your Participation</h2>
          
          {participation ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <ParticipationBadge participation={participation} />
                <div>
                  <p className="text-gray-300">
                    Status: <span className="font-semibold">{participation.participationStatus}</span>
                  </p>
                  <p className="text-sm text-gray-400">
                    Stall Stage: {participation.stallStage}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Last Activity</p>
                <p className="text-gray-300">
                  {participation.lastActivityDate 
                    ? new Date(participation.lastActivityDate).toLocaleDateString()
                    : 'No activities yet'
                  }
                </p>
              </div>
            </div>
          ) : canJoin ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">You&apos;re not participating in this cycle yet.</p>
              <JoinBuildButton
                userId={userId}
                cycleId={cycle.id}
                onSuccess={handleJoinSuccess}
                className="px-8 py-3 text-lg"
              />
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">
                {!isActive 
                  ? 'This cycle is not currently active for new participants.'
                  : 'You need to be logged in to participate in this cycle.'
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recent Activities */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Recent Activities</h2>
        
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-800 rounded-lg h-16"></div>
            ))}
          </div>
        ) : activities.length > 0 ? (
          <div className="space-y-3">
            {activities.slice(0, 5).map((activity: any) => (
              <div key={activity.id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    activity.status === 'verified' ? 'bg-green-500' :
                    activity.status === 'rejected' ? 'bg-red-500' :
                    'bg-yellow-500'
                  }`} />
                  <div>
                    <p className="text-gray-200 font-medium">{activity.contributionType}</p>
                    <p className="text-sm text-gray-400">{activity.user?.name || 'Unknown User'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">
                    {new Date(activity.createdAt).toLocaleDateString()}
                  </p>
                  <p className={`text-sm font-medium ${
                    activity.status === 'verified' ? 'text-green-400' :
                    activity.status === 'rejected' ? 'text-red-400' :
                    'text-yellow-400'
                  }`}>
                    {activity.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No activities submitted yet.</p>
          </div>
        )}
      </div>

      {/* Participants */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Participants</h2>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-800 rounded-lg h-20"></div>
            ))}
          </div>
        ) : participants.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {participants.map((participant: any) => (
              <div key={participant.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-200 font-medium">{participant.user?.name || 'Unknown'}</p>
                  <div className={`w-2 h-2 rounded-full ${
                    participant.stallStage === 'active' ? 'bg-green-500' :
                    participant.stallStage === 'grace' ? 'bg-blue-500' :
                    participant.stallStage === 'at_risk' ? 'bg-yellow-500' :
                    participant.stallStage === 'diminishing' ? 'bg-orange-500' :
                    'bg-red-500'
                  }`} />
                </div>
                <p className="text-sm text-gray-400">
                  Status: {participant.participationStatus}
                </p>
                <p className="text-xs text-gray-500">
                  Stage: {participant.stallStage}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No participants yet.</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {participation && isActive && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => window.location.href = '/activity'}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
            >
              Submit Activity
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors font-medium"
            >
              View Dashboard
            </button>
            <button
              onClick={() => window.location.href = '/team'}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors font-medium"
            >
              Team Activity
            </button>
          </div>
        </div>
      )}
    </div>
  );
}