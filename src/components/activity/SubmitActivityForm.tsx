'use client';

import { useState } from 'react';
import { submitActivity } from '@/lib/activity';

interface SubmitActivityFormProps {
  userId: string;
  cycleId: string;
  onSuccess: () => void;
}

const ACTIVITY_TYPES = [
  { value: 'task_completed', label: 'Task Completed' },
  { value: 'pr_submitted', label: 'PR Submitted' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'review_work', label: 'Review Work' },
  { value: 'hours_logged', label: 'Hours Logged' },
];

export default function SubmitActivityForm({ userId, cycleId, onSuccess }: SubmitActivityFormProps) {
  const [activityType, setActivityType] = useState('task_completed');
  const [proofLink, setProofLink] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    console.log('🚀 Submitting activity:', {
      userId,
      cycleId,
      activityType,
      proofLink,
      description: description || '(none)'
    });

    try {
      const result = await submitActivity(
        userId,
        cycleId,
        activityType,
        proofLink,
        description
      );

      console.log('📥 Activity submission result:', result);

      if (result.success) {
        console.log('✅ Activity submitted successfully:', result.activity);
        setSuccess(true);
        setProofLink('');
        setDescription('');
        setActivityType('task_completed');
        
        // Show success animation
        setTimeout(() => {
          setSuccess(false);
          onSuccess();
        }, 2000);
      } else {
        console.error('❌ Activity submission failed:', result.error);
        setError(result.error || 'Failed to submit activity');
      }
    } catch (err: any) {
      console.error('💥 Activity submission error:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 className="text-xl font-semibold text-gray-100 mb-4">Submit Activity</h2>
      
      {success && (
        <div className="mb-4 p-4 bg-green-900/20 border border-green-800/50 rounded-lg animate-in fade-in zoom-in duration-300">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✓</span>
            <div>
              <p className="text-green-400 font-medium">Activity submitted successfully!</p>
              <p className="text-sm text-green-400/80">Your participation status has been updated.</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="activityType" className="block text-sm font-medium text-gray-300 mb-2">
            Activity Type
          </label>
          <select
            id="activityType"
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          >
            {ACTIVITY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="proofLink" className="block text-sm font-medium text-gray-300 mb-2">
            Proof Link <span className="text-red-400">*</span>
          </label>
          <input
            type="url"
            id="proofLink"
            value={proofLink}
            onChange={(e) => setProofLink(e.target.value)}
            required
            disabled={loading}
            placeholder="https://github.com/user/repo/pull/123"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-gray-500">
            Link to GitHub PR, commit, issue, or other verifiable work
          </p>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
            Description <span className="text-gray-500">(optional)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
            rows={3}
            placeholder="Brief description of what you accomplished..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !proofLink.trim()}
          className="w-full px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Submitting...
            </>
          ) : (
            'Submit Activity'
          )}
        </button>
      </form>

      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-xs text-blue-400">
          <strong>Note:</strong> Only verifiable work counts. Messages or intent do not count as activity.
        </p>
      </div>
    </div>
  );
}
