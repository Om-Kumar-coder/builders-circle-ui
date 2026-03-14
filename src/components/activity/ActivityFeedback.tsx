'use client';

import { MessageSquare, User, Clock } from 'lucide-react';

interface ActivityFeedbackProps {
  feedbackComment?: string;
  feedbackAuthor?: {
    id: string;
    name: string;
    email: string;
  };
  feedbackTimestamp?: string;
  rejectionReason?: string;
  status: string;
}

export default function ActivityFeedback({ 
  feedbackComment, 
  feedbackAuthor, 
  feedbackTimestamp, 
  rejectionReason,
  status 
}: ActivityFeedbackProps) {
  if (!feedbackComment && !rejectionReason) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'border-green-500/30 bg-green-500/10';
      case 'rejected':
        return 'border-red-500/30 bg-red-500/10';
      case 'changes_requested':
        return 'border-yellow-500/30 bg-yellow-500/10';
      default:
        return 'border-gray-500/30 bg-gray-500/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return '✅';
      case 'rejected':
        return '❌';
      case 'changes_requested':
        return '⚠️';
      default:
        return '💬';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className={`border rounded-lg p-4 mt-4 ${getStatusColor(status)}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-2xl">
          {getStatusIcon(status)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-200">
              Admin Feedback
            </span>
            {feedbackTimestamp && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                {formatTime(feedbackTimestamp)}
              </div>
            )}
          </div>

          {feedbackAuthor && (
            <div className="flex items-center gap-2 mb-2">
              <User className="w-3 h-3 text-gray-500" />
              <span className="text-xs text-gray-400">
                {feedbackAuthor.name || feedbackAuthor.email}
              </span>
            </div>
          )}

          {rejectionReason && (
            <div className="mb-2">
              <p className="text-sm text-gray-300">
                <span className="font-medium">Reason:</span> {rejectionReason}
              </p>
            </div>
          )}

          {feedbackComment && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-sm text-gray-200 leading-relaxed">
                {feedbackComment}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}