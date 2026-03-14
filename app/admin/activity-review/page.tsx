'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import { ActivityEvent } from '@/types/activity';
import { ACTIVITY_TYPE_LABELS } from '@/types/activity';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock, 
  ExternalLink, 
  User,
  Calendar,
  RefreshCw
} from 'lucide-react';

export default function ActivityReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  const fetchPendingActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getPendingActivities();
      setActivities(data);
    } catch (err: unknown) {
      console.error('Error fetching pending activities:', err);
      setError((err as Error).message || 'Failed to fetch pending activities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'founder') {
      fetchPendingActivities();
    }
  }, [user]);

  const handleVerification = async (
    activityId: string,
    status: 'verified' | 'rejected' | 'changes_requested',
    rejectionReason?: string
  ) => {
    try {
      setVerifying(activityId);
      
      // Calculate ownership for verified activities
      const activity = activities.find(a => a.id === activityId);
      let calculatedOwnership = 0;
      
      if (status === 'verified' && activity) {
        const baseReward = 0.1;
        const hoursLogged = activity.hoursLogged || 1;
        const hoursFactor = Math.min(hoursLogged / 4, 2); // Cap at 2x for 4+ hours
        calculatedOwnership = baseReward * activity.contributionWeight * hoursFactor;
      }

      await apiClient.verifyActivity(activityId, {
        status,
        rejectionReason,
        calculatedOwnership: status === 'verified' ? calculatedOwnership : undefined,
      });

      // Remove from pending list
      setActivities(prev => prev.filter(a => a.id !== activityId));
    } catch (err: unknown) {
      console.error('Error verifying activity:', err);
      setError((err as Error).message || 'Failed to verify activity');
    } finally {
      setVerifying(null);
    }
  };

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user || (user.role !== 'admin' && user.role !== 'founder')) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-100 mb-2">Access Denied</h1>
          <p className="text-gray-400">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Activity Review</h1>
            <p className="text-gray-400 mt-1">Review and verify submitted activities</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchPendingActivities}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 
                border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-yellow-400" />
              <div>
                <p className="text-sm text-gray-400">Pending Review</p>
                <p className="text-2xl font-bold text-gray-100">{activities.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <User className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">Contributors</p>
                <p className="text-2xl font-bold text-gray-100">
                  {new Set(activities.map(a => a.userId)).size}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-sm text-gray-400">Total Hours</p>
                <p className="text-2xl font-bold text-gray-100">
                  {activities.reduce((sum, a) => sum + (a.hoursLogged || 0), 0).toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Activities List */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-6">Pending Activities</h2>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6 animate-pulse">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-700 rounded-full"></div>
                    <div className="flex-1 space-y-3">
                      <div className="h-4 bg-gray-700 rounded w-1/3"></div>
                      <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                      <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">All caught up!</p>
              <p className="text-sm text-gray-500">No activities pending review</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <ActivityReviewCard
                  key={activity.id}
                  activity={activity}
                  onVerify={handleVerification}
                  isVerifying={verifying === activity.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ActivityReviewCardProps {
  activity: ActivityEvent;
  onVerify: (id: string, status: 'verified' | 'rejected' | 'changes_requested', reason?: string) => void;
  isVerifying: boolean;
}

function ActivityReviewCard({ activity, onVerify, isVerifying }: ActivityReviewCardProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    onVerify(activity.id, 'rejected', rejectionReason);
    setShowRejectForm(false);
    setRejectionReason('');
  };

  const handleRequestChanges = () => {
    if (!rejectionReason.trim()) {
      alert('Please provide details about what changes are needed');
      return;
    }
    onVerify(activity.id, 'changes_requested', rejectionReason);
    setShowRejectForm(false);
    setRejectionReason('');
  };

  // Calculate potential ownership reward
  const baseReward = 0.1;
  const hoursLogged = activity.hoursLogged || 1;
  const hoursFactor = Math.min(hoursLogged / 4, 2);
  const potentialOwnership = baseReward * activity.contributionWeight * hoursFactor;

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6 hover:bg-gray-800/70 transition-colors">
      <div className="flex items-start gap-4">
        {/* User Avatar */}
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
          {activity.user?.name?.charAt(0) || activity.user?.email?.charAt(0) || '?'}
        </div>

        {/* Activity Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-100">
                {ACTIVITY_TYPE_LABELS[activity.contributionType as keyof typeof ACTIVITY_TYPE_LABELS] || activity.contributionType}
              </h3>
              <p className="text-sm text-gray-400">
                by {activity.user?.name || activity.user?.email} • {activity.cycle?.name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">
                {new Date(activity.createdAt).toLocaleDateString()}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(activity.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Activity Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-400 mb-1">Activity Type</p>
              <p className="text-gray-200">{activity.activityType}</p>
            </div>
            {activity.hoursLogged && (
              <div>
                <p className="text-sm text-gray-400 mb-1">Hours Logged</p>
                <p className="text-gray-200">{activity.hoursLogged} hours</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-400 mb-1">Contribution Weight</p>
              <p className="text-gray-200">{activity.contributionWeight}x</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Potential Ownership</p>
              <p className="text-green-400 font-semibold">{potentialOwnership.toFixed(3)}</p>
            </div>
          </div>

          {/* Description */}
          {activity.description && (
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-1">Description</p>
              <p className="text-gray-200 text-sm">{activity.description}</p>
            </div>
          )}

          {/* Work Summary */}
          {activity.workSummary && (
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-1">Work Summary</p>
              <p className="text-gray-200 text-sm">{activity.workSummary}</p>
            </div>
          )}

          {/* Task Reference */}
          {activity.taskReference && (
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-1">Task Reference</p>
              <p className="text-gray-200 text-sm">{activity.taskReference}</p>
            </div>
          )}

          {/* Proof Link */}
          <div className="mb-4">
            <p className="text-sm text-gray-400 mb-1">Proof Link</p>
            <a
              href={activity.proofLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="truncate max-w-md">{activity.proofLink}</span>
            </a>
          </div>

          {/* Rejection Form */}
          {showRejectForm && (
            <div className="mb-4 p-4 bg-gray-900 border border-gray-700 rounded-lg">
              <label className="block text-sm text-gray-400 mb-2">
                Reason for rejection / changes needed:
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this activity is being rejected or what changes are needed..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 
                  placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={3}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleReject}
                  disabled={isVerifying}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg 
                    transition-colors disabled:opacity-50 text-sm"
                >
                  Reject Activity
                </button>
                <button
                  onClick={handleRequestChanges}
                  disabled={isVerifying}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg 
                    transition-colors disabled:opacity-50 text-sm"
                >
                  Request Changes
                </button>
                <button
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectionReason('');
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg 
                    transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => onVerify(activity.id, 'verified')}
              disabled={isVerifying}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 
                text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Approve</span>
            </button>
            <button
              onClick={() => setShowRejectForm(!showRejectForm)}
              disabled={isVerifying}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 
                text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
            >
              <XCircle className="w-4 h-4" />
              <span>Reject</span>
            </button>
            <button
              onClick={() => setShowRejectForm(!showRejectForm)}
              disabled={isVerifying}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 
                text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Request Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}