'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { apiClient } from '@/lib/api-client';
import { Users, RefreshCw, Activity, Clock, AlertCircle } from 'lucide-react';

interface TeamMember {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  role?: string;
  participationStatus: string;
  stallStage: string;
  lastActivityDate?: string;
  optedIn: boolean;
}

interface ParticipationStats {
  total: number;
  active: number;
  atRisk: number;
  paused: number;
}

export default function TeamPage() {
  const { user, loading: authLoading } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // TODO: Get active cycle ID from context or user selection
  const cycleId = 'cycle456';

  const isAdmin = user?.role === 'admin' || user?.role === 'founder';

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      setError('');

      if (!isAdmin) {
        setError('Admin access required to view team members');
        return;
      }

      const participants = await apiClient.getTeamMembers(cycleId);
      
      // Transform the data to match our interface
      const transformedMembers: TeamMember[] = participants.map((participant: any) => ({
        id: participant.id,
        userId: participant.userId,
        userName: participant.user.name,
        userEmail: participant.user.email,
        role: participant.user.profile?.role || 'contributor',
        participationStatus: participant.participationStatus,
        stallStage: participant.calculatedStallStage || participant.stallStage,
        lastActivityDate: participant.lastActivityDate,
        optedIn: participant.optedIn
      }));

      setTeamMembers(transformedMembers);
    } catch (err: any) {
      setError(err.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamMembers();
  }, [cycleId]);

  const getStatusColor = (stallStage: string) => {
    switch (stallStage) {
      case 'active':
      case 'none':
        return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'at_risk':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'diminishing':
        return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'paused':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'grace':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getStatusLabel = (stallStage: string) => {
    switch (stallStage) {
      case 'active':
        return 'Active';
      case 'at_risk':
        return 'At Risk';
      case 'diminishing':
        return 'Diminishing';
      case 'paused':
        return 'Paused';
      case 'grace':
        return 'Grace Period';
      case 'none':
        return 'Active';
      default:
        return 'Unknown';
    }
  };

  const formatLastActivity = (dateString?: string) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const stats: ParticipationStats = {
    total: teamMembers.length,
    active: teamMembers.filter(m => m.stallStage === 'active' || m.stallStage === 'none').length,
    atRisk: teamMembers.filter(m => m.stallStage === 'at_risk' || m.stallStage === 'diminishing').length,
    paused: teamMembers.filter(m => m.stallStage === 'paused').length,
  };

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <MainLayout title="Team">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400">Please log in to view the team.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Team">
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-100">Team Members</h1>
            <p className="text-gray-400 mt-1">View contributors and participation health</p>
          </div>
          <button
            onClick={fetchTeamMembers}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 
              border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Admin Stats Overview */}
        {isAdmin && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-400">Total Members</p>
              </div>
              <p className="text-2xl font-bold text-gray-100">{stats.total}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-green-400" />
                <p className="text-sm text-gray-400">Active</p>
              </div>
              <p className="text-2xl font-bold text-green-400">{stats.active}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                <p className="text-sm text-gray-400">At Risk</p>
              </div>
              <p className="text-2xl font-bold text-yellow-400">{stats.atRisk}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-red-400" />
                <p className="text-sm text-gray-400">Paused</p>
              </div>
              <p className="text-2xl font-bold text-red-400">{stats.paused}</p>
            </div>
          </div>
        )}

        {/* Team Members Grid */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-6">Contributors</h2>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gray-700 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-700 rounded w-2/3"></div>
                      <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4 opacity-50">👥</div>
              <p className="text-gray-400 mb-2">No team members yet</p>
              <p className="text-sm text-gray-500">
                Team members will appear here once they join the cycle
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 hover:bg-gray-800 hover:border-gray-600 transition-all"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                      {(member.userName || member.userEmail || 'U')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-gray-200 font-medium truncate">
                        {member.userName || member.userEmail || `User ${member.userId.slice(0, 8)}`}
                      </h3>
                      {member.role && (
                        <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Status:</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(member.stallStage)}`}>
                        {getStatusLabel(member.stallStage)}
                      </span>
                    </div>

                    {/* Last Activity */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Last Activity:</span>
                      <span className="text-xs text-gray-300">
                        {formatLastActivity(member.lastActivityDate)}
                      </span>
                    </div>

                    {/* Stall Stage Visual */}
                    <div className="pt-2 border-t border-gray-700/50">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          member.stallStage === 'active' || member.stallStage === 'none' ? 'bg-green-500' :
                          member.stallStage === 'at_risk' ? 'bg-yellow-500' :
                          member.stallStage === 'diminishing' ? 'bg-orange-500' :
                          member.stallStage === 'paused' ? 'bg-red-500' :
                          'bg-blue-500'
                        }`}></div>
                        <span className="text-xs text-gray-400">
                          {member.stallStage === 'active' || member.stallStage === 'none' ? 'Contributing regularly' :
                           member.stallStage === 'at_risk' ? 'Needs attention' :
                           member.stallStage === 'diminishing' ? 'Activity declining' :
                           member.stallStage === 'paused' ? 'No recent activity' :
                           'New member'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Participation Status Guide</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full mt-1"></div>
              <div>
                <p className="text-sm font-medium text-gray-200">Active</p>
                <p className="text-xs text-gray-400">Contributing regularly (0-6 days inactive)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 bg-yellow-500 rounded-full mt-1"></div>
              <div>
                <p className="text-sm font-medium text-gray-200">At Risk</p>
                <p className="text-xs text-gray-400">Reduced activity (7-20 days inactive)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full mt-1"></div>
              <div>
                <p className="text-sm font-medium text-gray-200">Paused</p>
                <p className="text-xs text-gray-400">No recent activity (21+ days inactive)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full mt-1"></div>
              <div>
                <p className="text-sm font-medium text-gray-200">Grace Period</p>
                <p className="text-xs text-gray-400">New member, no activity yet</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
