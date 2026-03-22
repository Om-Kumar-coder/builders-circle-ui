'use client';

import { useState } from 'react';
import { Plus, X, CheckCircle, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const ROLE_OPTIONS = [
  { value: 'dev', label: 'Developer' },
  { value: 'business', label: 'Business' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'design', label: 'Design' },
  { value: 'other', label: 'Other' },
];

const TYPE_OPTIONS = [
  { value: 'join', label: 'Join the team' },
  { value: 'project', label: 'Propose a project' },
  { value: 'other', label: 'Other' },
];

export default function TriageSubmissionForm() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    roleType: 'dev',
    submissionType: 'join',
    description: '',
    availability: '',
  });
  const [proofLinks, setProofLinks] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const descLen = form.description.length;

  function addLink() {
    if (proofLinks.length < 5) setProofLinks(prev => [...prev, '']);
  }

  function removeLink(i: number) {
    setProofLinks(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateLink(i: number, val: string) {
    setProofLinks(prev => prev.map((l, idx) => idx === i ? val : l));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const links = proofLinks.filter(l => l.trim());
      await apiClient.submitTriage({ ...form, proofLinks: links.length ? links : undefined });
      setSuccess(true);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e.status === 429) {
        setError("You've submitted recently. Please wait before trying again.");
      } else if (e.status === 409) {
        setError("A pending application for this email already exists. Please wait for review.");
      } else {
        setError(e.message ?? 'Submission failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-100 mb-2">Application Submitted</h2>
        <p className="text-gray-400">We'll review your application and reach out via email.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            required minLength={2} maxLength={100}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            required
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Role Type *</label>
          <select
            value={form.roleType}
            onChange={e => setForm(p => ({ ...p, roleType: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Submission Type *</label>
          <select
            value={form.submissionType}
            onChange={e => setForm(p => ({ ...p, submissionType: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Description * <span className={`text-xs ${descLen < 50 ? 'text-red-400' : 'text-gray-500'}`}>({descLen}/2000)</span>
        </label>
        <textarea
          value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          required minLength={50} maxLength={2000}
          rows={5}
          placeholder="Tell us about yourself, your skills, and what you'd like to contribute..."
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">Proof Links (optional, max 5)</label>
          {proofLinks.length < 5 && (
            <button type="button" onClick={addLink} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              <Plus size={14} /> Add link
            </button>
          )}
        </div>
        <div className="space-y-2">
          {proofLinks.map((link, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="url"
                value={link}
                onChange={e => updateLink(i, e.target.value)}
                placeholder="https://github.com/..."
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {proofLinks.length > 1 && (
                <button type="button" onClick={() => removeLink(i)} className="p-2 text-gray-500 hover:text-red-400 transition-colors" aria-label="Remove link">
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Availability (optional)</label>
        <input
          type="text"
          value={form.availability}
          onChange={e => setForm(p => ({ ...p, availability: e.target.value }))}
          maxLength={200}
          placeholder="e.g. 20h/week, weekends only..."
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-red-400 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || descLen < 50}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
      >
        {submitting ? 'Submitting...' : 'Submit Application'}
      </button>
    </form>
  );
}
