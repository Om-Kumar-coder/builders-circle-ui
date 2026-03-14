'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ActivityEvent, STATUS_CONFIG, ACTIVITY_TYPE_LABELS } from '@/types/activity';
import { Clock, ExternalLink, User, Calendar, AlertCircle, AlertTriangle } from 'lucide-react';
import ActivityFeedback from './ActivityFeedback';
import DisputeSubmissionModal from './DisputeSubmissionModal';

interface ActivityItemProps {
  activity: ActivityEvent;
  showUser?: boolean;
}

export default function ActivityItem({ activity, showUser = false }: ActivityItemProps) {
  const { user } = useAuth();
  const [showDisputeModal, setShowDisputeModal] = useState(false);

  const isOwnActivity = user?.id === activity.userId;
  const canDispute = isOwnActivity && (activity.status === 'rejected' || activity.status === 'changes_requested');
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const statusConfig = STATUS_CONFIG[activity.status];
  const activityLabel = ACTIVITY_TYPE_LABELS[activity.contributionType] || activity.contributionType;

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 hover:border-gray-600/50 transition-colors">
      <div className="flex items-start gap-4">
        {/* Activity Icon */}
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-semibold flex-shrink-0">
          {activity.contributionType === 'code' && '💻'}
          {activity.contributionType === 'documentation' && '📝'}
          {activity.contributionType === 'review' && '👀'}
          {activity.contributionType === 'hours_logged' && '⏱️'}
          {activity.contributionType === 'meeting' && '🤝'}
          {activity.contributionType === 'research' && '🔍'}
          {activity.contributionType === 'task_completion' && '✅'}
        </div>

        {/* Activity Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-gray-200">{activity.activityType}</h3>
                <span className={`text-xs px-2 py-1 rounded-full border ${statusConfig.bgColor} ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
              </div>
              <p className="text-sm text-gray-400">{activityLabel}</p>
            </div>
            <div className="text-right text-xs text-gray-500">
              <p>{formatTimeAgo(activity.createdAt)}</p>
              {activity.hoursLogged && (
                <p className="flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" />
                  {activity.hoursLogged}h
                </p>
              )}
            </div>
          </div>

          {/* User Info (if showing user) */}
          {showUser && activity.user && (
            <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
              <User className="w-4 h-4" />
              <span>{activity.user.name || activity.user.email}</span>
            </div>
          )}

          {/* Work Summary */}
          {activity.workSummary && (
            <div className="mb-2">
              <p className="text-sm text-gray-300">{activity.workSummary}</p>
            </div>
          )}

          {/* Description */}
          {activity.description && (
            <div className="mb-2">
              <p className="text-sm text-gray-400">{activity.description}</p>
            </div>
          )}

          {/* Task Reference */}
          {activity.taskReference && (
            <div className="mb-2">
              <p className="text-xs text-gray-500">
                <span className="font-medium">Task:</span> {activity.taskReference}
              </p>
            </div>
          )}

          {/* Verification Info */}
          {activity.status === 'verified' && activity.verifier && (
            <div className="mb-2 text-xs text-green-400">
              <p>Verified by {activity.verifier.name || activity.verifier.email}</p>
              {activity.verifiedAt && (
                <p>on {new Date(activity.verifiedAt).toLocaleDateString()}</p>
              )}
              {activity.calculatedOwnership > 0 && (
                <p>Ownership earned: {activity.calculatedOwnership.toFixed(3)}</p>
              )}
            </div>
          )}

          {/* Legacy Rejection Reason (for backward compatibility) */}
          {(activity.status === 'rejected' || activity.status === 'changes_requested') && activity.rejectionReason && !activity.feedbackComment && (
            <div className="mb-2 p-2 bg-red-900/20 border border-red-800/50 rounded text-xs text-red-400">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">
                    {activity.status === 'rejected' ? 'Rejection Reason:' : 'Changes Requested:'}
                  </p>
                  <p>{activity.rejectionReason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(activity.createdAt).toLocaleDateString()}
              </span>
              {activity.contributionWeight !== 1 && (
                <span>Weight: {activity.contributionWeight}x</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {canDispute && (
                <button
                  onClick={() => setShowDisputeModal(true)}
                  className="flex items-center gap-1 text-yellow-400 hover:text-yellow-300 hover:underline"
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Dispute</span>
                </button>
              )}
              <a
                href={activity.proofLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                <span>View Proof</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Feedback Component */}
      <ActivityFeedback
        feedbackComment={activity.feedbackComment}
        feedbackAuthor={activity.feedbackGiver}
        feedbackTimestamp={activity.feedbackTimestamp}
        rejectionReason={activity.rejectionReason}
        status={activity.status}
      />

      {/* Dispute Submission Modal */}
      <DisputeSubmissionModal
        isOpen={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        activityId={activity.id}
        activityDescription={activity.description || activity.activityType}
        onSuccess={() => {
          // Could refresh the activity list or show a success message
        }}
      />
    </div>
  );
}
