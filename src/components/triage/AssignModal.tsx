'use client';

import { useState } from 'react';
import { X, UserCheck } from 'lucide-react';
import type { TriageSubmission } from '@/hooks/useTriage';

const ROLE_OPTIONS = [
  { value: 'contributor', label: 'Contributor' },
  { value: 'employee', label: 'Employee' },
  { value: 'observer', label: 'Observer' },
  { value: 'admin', label: 'Admin' },
];

interface AssignModalProps {
  submission: TriageSubmission;
  onConfirm: (role: string) => void;
  onClose: () => void;
  loading?: boolean;
  error?: string;
}

export default function AssignModal({ submission, onConfirm, onClose, loading, error }: AssignModalProps) {
  const [role, setRole] = useState('contributor');

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-semibold text-gray-100">Assign &amp; Approve</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors" aria-label="Close">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div className="bg-gray-800/60 rounded-xl p-4 text-sm space-y-1">
              <p className="text-gray-400">Applicant</p>
              <p className="text-gray-100 font-medium">{submission.name}</p>
              <p className="text-gray-400">{submission.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Assign Role
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {ROLE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                This sets the user&apos;s platform role. Group is auto-assigned based on role.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm(role)}
                disabled={loading}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? 'Approving...' : 'Approve & Send Invite'}
              </button>
            </div>
            {error && (
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
