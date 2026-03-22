'use client';

import { useState, useEffect } from 'react';
import { submitActivity } from '@/lib/activity';
import { ActivitySubmission, ACTIVITY_TYPE_LABELS, ACTIVITY_LIMITS } from '@/types/activity';
import { Clock, FileText, Link as LinkIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface SubmitActivityFormProps {
  userId: string;
  cycleId: string;
  onSuccess: () => void;
  /** Pre-select a task (e.g. when redirected from "Submit Activity to Complete") */
  initialTaskId?: string;
}

export default function SubmitActivityForm({ userId, cycleId, onSuccess, initialTaskId }: SubmitActivityFormProps) {
  const [formData, setFormData] = useState<Partial<ActivitySubmission>>({
    cycleId,
    contributionType: initialTaskId ? 'task_completion' : 'code',
    activityType: '',
    proofLink: '',
    description: '',
    hoursLogged: undefined,
    workSummary: '',
    taskReference: '',
  });
  const [linkedTaskId, setLinkedTaskId] = useState<string>(initialTaskId ?? '');
  const [assignedTasks, setAssignedTasks] = useState<{ id: string; title: string; acceptanceCriteria?: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch assigned tasks for this cycle when contributionType is task_completion
  useEffect(() => {
    if (formData.contributionType === 'task_completion') {
      apiClient.getMyTasks()
        .then((assignments: { task?: { id: string; title: string; acceptanceCriteria?: string; cycleId?: string; status?: string } }[]) => {
          const tasks = assignments
            .filter(a => a.task?.cycleId === cycleId && a.task?.status !== 'completed')
            .map(a => ({ id: a.task!.id, title: a.task!.title, acceptanceCriteria: a.task!.acceptanceCriteria }));
          setAssignedTasks(tasks);
        })
        .catch(() => setAssignedTasks([]));
    }
  }, [formData.contributionType, cycleId]);

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
        linkedTaskId: linkedTaskId || undefined,
        contributionType: formData.contributionType!,
        contributionWeight: 1.0,
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit activity');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof ActivitySubmission, value: string | number | undefined) => {
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
            onChange={(e) => handleInputChange('contributionType', e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          >
            {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Link to Task (task_completion only) */}
        {formData.contributionType === 'task_completion' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Link to Task</label>
            {assignedTasks.length === 0 ? (
              <p className="text-sm text-gray-500 italic">You have no assigned tasks in this cycle. You can still submit without linking.</p>
            ) : (
              <select
                value={linkedTaskId}
                onChange={e => setLinkedTaskId(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">No task linked</option>
                {assignedTasks.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            )}
            {linkedTaskId && assignedTasks.find(t => t.id === linkedTaskId)?.acceptanceCriteria && (
              <div className="mt-2 p-3 bg-gray-800/60 rounded-lg text-xs text-gray-400">
                <p className="font-medium text-gray-300 mb-1">Acceptance Criteria</p>
                <p className="whitespace-pre-wrap">{assignedTasks.find(t => t.id === linkedTaskId)?.acceptanceCriteria}</p>
              </div>
            )}
          </div>
        )}

        {/* Activity Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Activity Type *
          </label>          <input
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
            {formData.contributionType === 'code' && 'GitHub/GitLab/Bitbucket commit, PR, or issue URL required.'}
            {formData.contributionType === 'documentation' && 'GitHub PR/commit, Notion, Confluence, or Google Docs URL required.'}
            {formData.contributionType === 'review' && 'GitHub PR or GitLab merge request URL required.'}
            {formData.contributionType === 'task_completion' && 'GitHub issue/PR, Jira, Linear, or Notion task URL required.'}
            {['hours_logged', 'meeting', 'research'].includes(formData.contributionType ?? '') && 'Any verifiable HTTPS URL accepted.'}
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