'use client';

import type { ActivityEvent } from '@/lib/activity';

interface ActivityItemProps {
  activity: ActivityEvent;
  showUser?: boolean;
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  task_completed: 'Task Completed',
  pr_submitted: 'PR Submitted',
  documentation: 'Documentation',
  review_work: 'Review Work',
  hours_logged: 'Hours Logged',
};

const ACTIVITY_TYPE_ICONS: Record<string, string> = {
  task_completed: '✓',
  pr_submitted: '🔀',
  documentation: '📝',
  review_work: '👀',
  hours_logged: '⏱️',
};

const VERIFICATION_STATUS = {
  pending: { label: 'Pending', color: 'text-gray-400', bg: 'bg-gray-800/50', icon: '⏳' },
  verified: { label: 'Verified', color: 'text-green-400', bg: 'bg-green-900/20', icon: '✓' },
  rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-900/20', icon: '✗' },
};

export default function ActivityItem({ activity, showUser = false }: ActivityItemProps) {
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

  const activityLabel = ACTIVITY_TYPE_LABELS[activity.activityType] || activity.activityType;
  const activityIcon = ACTIVITY_TYPE_ICONS[activity.activityType] || '📌';
  const verificationStatus = VERIFICATION_STATUS[activity.verified as keyof typeof VERIFICATION_STATUS] || VERIFICATION_STATUS.pending;

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 hover:border-gray-600/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <span className="text-2xl mt-0.5">{activityIcon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-medium text-gray-200">{activityLabel}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${verificationStatus.bg} ${verificationStatus.color} flex items-center gap-1`}>
                <span>{verificationStatus.icon}</span>
                {verificationStatus.label}
              </span>
            </div>
            
            {activity.description && (
              <p className="text-sm text-gray-400 mb-2 line-clamp-2">
                {activity.description}
              </p>
            )}
            
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{formatTimeAgo(activity.$createdAt)}</span>
              <a
                href={activity.proofLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
              >
                View Proof
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
