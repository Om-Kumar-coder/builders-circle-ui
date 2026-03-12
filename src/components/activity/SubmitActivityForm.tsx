'use client';

import { useState } from 'react';
import { submitActivity } from '@/lib/activity';
import { ActivitySubmission, ACTIVITY_TYPE_LABELS, CONTRIBUTION_WEIGHTS, ACTIVITY_LIMITS } from '@/types/activity';
import { Clock, FileText, Link as LinkIcon, CheckCircle, AlertCircle } from 'lucide-react';

interface SubmitActivityFormProps {
  userId: string;
  cycleId: string;
  onSuccess: () => void;
}

export default function SubmitActivityForm({ userId, cycleId, onSuccess }: SubmitActivityFormProps) {
  const [formData, setFormData] = useState<Partial<ActivitySubmission>>({
    cycleId,
    contributionType: 'code',
    activityType: '',
    proofLink: '',
    description: '',
    hoursLogged: undefined,
    workSummary: '',
    taskReference: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.activityType || !formData.proofLink || !formData.contributionType) {
      setError('Please fill in all required fields');
      return;
    }

    // Validate hours if provided
    if (formData.hoursLogged !== undefined) {
      if (formData.hoursLogged <= 0 || formData.hoursLogged > ACTIVITY_LIMITS.MAX_HOURS_PER_DAY) {
        setError(`Hours must be between 0.1 and ${ACTIVITY_LIMITS.MAX_HOURS_PER_DAY}`);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const submission: ActivitySubmission = {
        cycleId,
        activityType: formData.activityType!,
        proofLink: formData.proofLink!,
        description: formData.description,
        hoursLogged: formData.hoursLogged,
        workSummary: formData.workSummary,
        taskReference: formData.taskReference,
        contributionType: formData.contributionType!,
        contributionWeight: CONTRIBUTION_WEIGHTS[formData.contributionType!],
      };

      const result = await submitActivity(userId, submission);
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        setError(result.error || 'Failed to submit activity');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit activity');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof ActivitySubmission, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  if (success) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-100 mb-2">Activity Submitted!</h3>
        <p className="text-gray-400">Your activity has been submitted for review.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-indigo-400" />
        <h2 className="text-xl font-semibold text-gray-100">Submit Activity</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contribution Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Contribution Type *
          </label>
          <select
            value={formData.contributionType}
            onChange={(e) => handleInputChange('contributionType', e.target.value as any)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          >
            {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label} (Weight: {CONTRIBUTION_WEIGHTS[value as keyof typeof CONTRIBUTION_WEIGHTS]}x)
              </option>
            ))}
          </select>
        </div>

        {/* Activity Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Activity Type *
          </label>
          <input
            type="text"
            value={formData.activityType}
            onChange={(e) => handleInputChange('activityType', e.target.value)}
            placeholder="e.g., Feature implementation, Bug fix, Documentation update"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>

        {/* Hours Logged */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Clock className="w-4 h-4 inline mr-1" />
            Hours Worked
          </label>
          <input
            type="number"
            step="0.25"
            min="0.1"
            max={ACTIVITY_LIMITS.MAX_HOURS_PER_DAY}
            value={formData.hoursLogged || ''}
            onChange={(e) => handleInputChange('hoursLogged', e.target.value ? parseFloat(e.target.value) : undefined)}
            placeholder="e.g., 2.5"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Optional. Maximum {ACTIVITY_LIMITS.MAX_HOURS_PER_DAY} hours per day.
          </p>
        </div>

        {/* Work Summary */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Work Summary
          </label>
          <textarea
            value={formData.workSummary}
            onChange={(e) => handleInputChange('workSummary', e.target.value)}
            placeholder="Briefly describe what you accomplished..."
            rows={3}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Task Reference */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Task/Issue Reference
          </label>
          <input
            type="text"
            value={formData.taskReference}
            onChange={(e) => handleInputChange('taskReference', e.target.value)}
            placeholder="e.g., Issue #123, Ticket ABC-456"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Proof Link */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <LinkIcon className="w-4 h-4 inline mr-1" />
            Proof Link *
          </label>
          <input
            type="url"
            value={formData.proofLink}
            onChange={(e) => handleInputChange('proofLink', e.target.value)}
            placeholder="https://github.com/repo/pull/123 or https://docs.example.com/page"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Link to PR, commit, document, or other proof of work
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Additional Details
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Any additional context or details about this activity..."
            rows={3}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-900/20 border border-red-800/50 rounded-lg text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 
              text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Activity'}
          </button>
        </div>

        {/* Info */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Activities are reviewed by admins before being verified</p>
          <p>• Ownership rewards are calculated based on contribution type and hours</p>
          <p>• Maximum {ACTIVITY_LIMITS.MAX_ACTIVITIES_PER_DAY} activities and {ACTIVITY_LIMITS.MAX_HOURS_PER_DAY} hours per day</p>
        </div>
      </form>
    </div>
  );
}