'use client';

import { useState } from 'react';
import { Plus, X, CheckCircle, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface IdeaSubmitFormProps {
  onSuccess?: () => void;
}

export default function IdeaSubmitForm({ onSuccess }: IdeaSubmitFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const descLen = description.length;

  function addAttachment() {
    setAttachments(prev => [...prev, '']);
  }

  function removeAttachment(i: number) {
    setAttachments(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateAttachment(i: number, val: string) {
    setAttachments(prev => prev.map((a, idx) => idx === i ? val : a));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const links = attachments.filter(a => a.trim());
      await apiClient.submitIdea({ title: title.trim(), description: description.trim(), attachments: links.length ? links : undefined });
      setSuccess(true);
      setTimeout(() => onSuccess?.(), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit idea');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-100 mb-2">Idea Submitted</h2>
        <p className="text-gray-400">Your idea is under review. You'll be notified when it's approved.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Title *</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required minLength={5} maxLength={200}
          placeholder="A concise name for your idea"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Description * <span className={`text-xs ${descLen < 100 ? 'text-red-400' : 'text-gray-500'}`}>({descLen}/5000)</span>
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          required minLength={100} maxLength={5000}
          rows={8}
          placeholder="Describe your idea in detail — what problem it solves, how it would work, and why it matters..."
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">Attachments (optional)</label>
          <button type="button" onClick={addAttachment} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            <Plus size={14} /> Add link
          </button>
        </div>
        <div className="space-y-2">
          {attachments.map((a, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="url"
                value={a}
                onChange={e => updateAttachment(i, e.target.value)}
                placeholder="https://..."
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {attachments.length > 1 && (
                <button type="button" onClick={() => removeAttachment(i)} className="p-2 text-gray-500 hover:text-red-400 transition-colors" aria-label="Remove">
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-red-400 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || title.trim().length < 5 || descLen < 100}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
      >
        {submitting ? 'Submitting...' : 'Submit Idea'}
      </button>
      {!submitting && (title.trim().length < 5 || descLen < 100) && (
        <p className="text-xs text-gray-500 text-center">
          {title.trim().length < 5
            ? 'Title must be at least 5 characters.'
            : `Description needs ${100 - descLen} more character${100 - descLen === 1 ? '' : 's'}.`}
        </p>
      )}
    </form>
  );
}
