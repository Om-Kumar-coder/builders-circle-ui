'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { AlertTriangle, X, MessageSquare } from 'lucide-react';

interface DisputeSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityId: string;
  activityDescription: string;
  onSuccess?: () => void;
}

export default function DisputeSubmissionModal({
  isOpen,
  onClose,
  activityId,
  activityDescription,
  onSuccess
}: DisputeSubmissionModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      setError('Please provide a reason for the dispute');
      return;
    }

    if (reason.trim().length < 10) {
      setError('Reason must be at least 10 characters long');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await apiClient.createDispute(activityId, reason.trim());

      alert('Dispute submitted successfully! An admin will review your case.');
      setReason('');
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit dispute');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setReason('');
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-100">Submit Dispute</h3>
              <p className="text-sm text-gray-400 mt-1">
                Challenge the decision on your activity submission
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Activity Info */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Activity Being Disputed</h4>
            <p className="text-gray-400 text-sm">{activityDescription}</p>
          </div>

          {/* Dispute Guidelines */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Dispute Guidelines
            </h4>
            <ul className="text-xs text-blue-300/80 space-y-1">
              <li>• Clearly explain why you believe the decision was incorrect</li>
              <li>• Provide specific evidence or reasoning to support your case</li>
              <li>• Be respectful and professional in your explanation</li>
              <li>• Include any additional context that may be relevant</li>
            </ul>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reason for Dispute *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-3 bg-gray-800 border border-gray-700 rounded-lg 
                text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 
                focus:border-transparent resize-none"
              placeholder="Explain why you believe this decision should be reconsidered. Be specific and provide evidence where possible..."
              rows={6}
              maxLength={1000}
              required
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500">
                Minimum 10 characters required
              </p>
              <p className="text-xs text-gray-500">
                {reason.length}/1000 characters
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-yellow-400 mb-1">Important Notice</h4>
                <p className="text-xs text-yellow-300/80">
                  Disputes are reviewed by administrators and may take time to resolve. 
                  Submitting frivolous or repeated disputes may affect your standing in the platform.
                  Only submit disputes when you genuinely believe an error has been made.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !reason.trim() || reason.trim().length < 10}
              className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg 
                font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Submit Dispute
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}