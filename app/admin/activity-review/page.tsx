'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
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
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import VeronicaBadge from '@/components/gatekeeper/VeronicaBadge';

export default function ActivityReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin } = usePermissions();
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

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
    if (isAdmin) {
      fetchPendingActivities();
    }
  }, [isAdmin]);

  const [overrideModal, setOverrideModal] = useState<{
    activityId: string;
    status: 'verified' | 'rejected' | 'changes_requested';
    rejectionReason?: string;
    gatekeeperStatus: string;
    aiScore: number | null;
  } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);

  const handleVerification = async (
    activityId: string,
    status: 'verified' | 'rejected' | 'changes_requested',
    rejectionReason?: string
  ) => {
    try {
      setVerifying(activityId);
      
      const activity = activities.find(a => a.id === activityId);
      let calculatedOwnership = 0;
      
      if (status === 'verified' && activity) {
        const baseReward = 0.1;
        const hoursLogged = activity.hoursLogged || 1;
        const hoursFactor = Math.min(hoursLogged / 4, 2);
        calculatedOwnership = baseReward * activity.contributionWeight * hoursFactor;
      }

      await apiClient.verifyActivity(activityId, {
        status,
        rejectionReason,
        calculatedOwnership: status === 'verified' ? calculatedOwnership : undefined,
      });

      setActivities(prev => prev.filter(a => a.id !== activityId));
      setSelected(prev => { const s = new Set(prev); s.delete(activityId); return s; });
    } catch (err: unknown) {
      const e = err as any;
      // Backend blocked due to gatekeeper flag — show override modal
      if (e?.status === 403 && e?.requiresOverride) {
        setOverrideModal({
          activityId,
          status,
          rejectionReason,
          gatekeeperStatus: e.gatekeeperStatus ?? 'FLAGGED',
          aiScore: e.aiScore ?? null,
        });
        return;
      }
      console.error('Error verifying activity:', err);
      setError(e.message || 'Failed to verify activity');
    } finally {
      setVerifying(null);
    }
  };

  const handleOverrideSubmit = async () => {
    if (!overrideModal || !overrideReason.trim()) return;
    setOverrideLoading(true);
    try {
      const activity = activities.find(a => a.id === overrideModal.activityId);
      let calculatedOwnership = 0;
      if (overrideModal.status === 'verified' && activity) {
        const baseReward = 0.1;
        const hoursLogged = activity.hoursLogged || 1;
        calculatedOwnership = baseReward * activity.contributionWeight * Math.min(hoursLogged / 4, 2);
      }
      await apiClient.verifyActivityWithOverride(
        overrideModal.activityId,
        {
          status: overrideModal.status,
          rejectionReason: overrideModal.rejectionReason,
          calculatedOwnership: overrideModal.status === 'verified' ? calculatedOwnership : undefined,
        },
        overrideReason
      );
      setActivities(prev => prev.filter(a => a.id !== overrideModal.activityId));
      setSelected(prev => { const s = new Set(prev); s.delete(overrideModal.activityId); return s; });
      setOverrideModal(null);
      setOverrideReason('');
    } catch (err: unknown) {
      setError((err as Error).message || 'Override failed');
    } finally {
      setOverrideLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) { s.delete(id); } else { s.add(id); }
      return s;
    });
  };

  const toggleSelectAll = () => {
    setSelected(prev => prev.size === activities.length ? new Set() : new Set(activities.map(a => a.id)));
  };

  const handleBulkApprove = async () => {
    if (selected.size === 0) return;
    setBulkProcessing(true);
    try {
      await Promise.all(Array.from(selected).map(id => handleVerification(id, 'verified')));
      setSelected(new Set());
    } finally {
      setBulkProcessing(false);
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
    <MainLayout title="Activity Review">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-100">Activity Review</h1>
              <p className="text-gray-400 mt-1">Review and verify submitted activities</p>
            </div>
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-100">Pending Activities</h2>
            {activities.length > 0 && !loading && (
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selected.size === activities.length && activities.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 accent-indigo-500"
                  />
                  Select all
                </label>
                {selected.size > 0 && (
                  <button
                    onClick={handleBulkApprove}
                    disabled={bulkProcessing}
                    className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve {selected.size} selected
                  </button>
                )}
              </div>
            )}
          </div>

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
                  selected={selected.has(activity.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Gatekeeper Override Modal */}
      {overrideModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-red-800/50 rounded-2xl w-full max-w-md">
            <div className="p-5 border-b border-gray-700">
              <div className="flex items-center gap-2 text-red-400 mb-1">
                <AlertTriangle className="w-5 h-5" />
                <h2 className="font-semibold">Gatekeeper Override Required</h2>
              </div>
              <p className="text-sm text-gray-400">
                This activity is <span className="text-red-400 font-medium">{overrideModal.gatekeeperStatus}</span>
                {overrideModal.aiScore != null && ` (AI score: ${Math.round(overrideModal.aiScore * 100)}%)`}.
                To proceed, provide a reason for overriding the gatekeeper decision.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Override Reason (required, min 10 chars)</label>
                <textarea
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  rows={3}
                  placeholder="Explain why you are overriding the gatekeeper decision..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 resize-none"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-700">
              <button
                onClick={() => { setOverrideModal(null); setOverrideReason(''); setError(null); }}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleOverrideSubmit}
                disabled={overrideReason.trim().length < 10 || overrideLoading}
                className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {overrideLoading ? 'Overriding...' : 'Override & Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
interface ActivityReviewCardProps {
  activity: ActivityEvent;
  onVerify: (id: string, status: 'verified' | 'rejected' | 'changes_requested', reason?: string) => void;
  isVerifying: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

function ActivityReviewCard({ activity, onVerify, isVerifying, selected, onToggleSelect }: ActivityReviewCardProps) {
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
    <div className={`bg-gray-800/50 border rounded-lg p-6 hover:bg-gray-800/70 transition-colors ${selected ? 'border-indigo-500/60' : 'border-gray-700/50'}`}>
      <div className="flex items-start gap-4">
        {/* Select checkbox */}
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect(activity.id)}
            className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 accent-indigo-500 flex-shrink-0"
          />
        )}
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

          {/* Veronica AI Review */}
          {activity.veronicaReview && (
            <div className="flex flex-col gap-2 mb-3 p-2 bg-gray-900/50 rounded-lg border border-gray-700/50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500">Veronica:</span>
                <VeronicaBadge status={activity.veronicaReview.status} score={activity.veronicaReview.veronicaScore} />
                {activity.veronicaReview.aiDecision && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                    activity.veronicaReview.aiDecision === 'AUTO_PASS'  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    activity.veronicaReview.aiDecision === 'AUTO_BLOCK' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {activity.veronicaReview.aiDecision.replace('_', ' ')}
                  </span>
                )}
                {activity.veronicaReview.veronicaFlags && activity.veronicaReview.veronicaFlags.length > 0 && (
                  activity.veronicaReview.veronicaFlags.map((f: string) => (
                    <span key={f} className="flex items-center gap-1 text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" />{f.replace(/_/g, ' ')}
                    </span>
                  ))
                )}
              </div>
              {activity.veronicaReview.veronicaNotes && (
                <span className="text-xs text-gray-500 italic">{activity.veronicaReview.veronicaNotes}</span>
              )}
              {activity.veronicaReview.reasoning && activity.veronicaReview.reasoning !== activity.veronicaReview.veronicaNotes && (
                <details>
                  <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400 transition-colors select-none">
                    AI reasoning ▸
                  </summary>
                  <p className="text-xs text-gray-400 mt-1 bg-gray-800/60 rounded p-2 border border-gray-700/50 leading-relaxed">
                    {activity.veronicaReview.reasoning}
                  </p>
                </details>
              )}
            </div>
          )}

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