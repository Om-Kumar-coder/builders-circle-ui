'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, Clock, AlertTriangle, Plus, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';

interface AccessGrant {
  id: string;
  type: string;
  value: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export default function AccessOverviewWidget() {
  const { user } = useAuth();
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqType, setReqType] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    apiClient.adminGetAccessGrants(user.id)
      .then(setGrants)
      .catch(() => setGrants([]))
      .finally(() => setLoading(false));
  }, [user]);

  const now = new Date();
  const activeGrants = grants.filter(g => !g.revokedAt && (!g.expiresAt || new Date(g.expiresAt) > now));
  const expiringSoon = activeGrants.filter(g => {
    if (!g.expiresAt) return false;
    const diff = new Date(g.expiresAt).getTime() - now.getTime();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  });

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqType || !reqReason) return;
    setSubmitting(true);
    try {
      await apiClient.submitAccessRequest(reqType, reqReason);
      setSuccessMsg('Request submitted. An admin will review it shortly.');
      setShowRequestForm(false);
      setReqType('');
      setReqReason('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const getExpiryColor = (expiresAt: string | null) => {
    if (!expiresAt) return 'text-green-400';
    const diff = new Date(expiresAt).getTime() - now.getTime();
    if (diff < 2 * 24 * 60 * 60 * 1000) return 'text-red-400';
    if (diff < 7 * 24 * 60 * 60 * 1000) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold text-gray-100">Access Overview</h2>
        </div>
        <button
          onClick={() => setShowRequestForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors"
        >
          {showRequestForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showRequestForm ? 'Cancel' : 'Request Access'}
        </button>
      </div>

      {successMsg && (
        <div className="bg-green-900/20 border border-green-800/50 text-green-400 px-3 py-2 rounded-lg text-sm">
          {successMsg}
        </div>
      )}

      {/* Role & tier */}
      <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
        <div className="p-2 bg-indigo-500/10 rounded-lg">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <p className="text-xs text-gray-400">Current Role</p>
          <p className="text-sm font-medium text-gray-100 capitalize">{user?.role ?? 'contributor'}</p>
        </div>
      </div>

      {expiringSoon.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-yellow-900/20 border border-yellow-800/40 rounded-lg text-sm text-yellow-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {expiringSoon.length} access grant{expiringSoon.length > 1 ? 's' : ''} expiring within 7 days
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-10 bg-gray-800 rounded-lg animate-pulse" />)}
        </div>
      ) : activeGrants.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No active access grants</p>
      ) : (
        <div className="space-y-2">
          {activeGrants.map(g => (
            <div key={g.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-200 capitalize">{g.type.replace(/_/g, ' ')}</p>
                {g.value && <p className="text-xs text-gray-400">{g.value}</p>}
              </div>
              {g.expiresAt ? (
                <div className="flex items-center gap-1 text-xs">
                  <Clock className={`w-3 h-3 ${getExpiryColor(g.expiresAt)}`} />
                  <span className={getExpiryColor(g.expiresAt)}>
                    {new Date(g.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-green-400">Permanent</span>
              )}
            </div>
          ))}
        </div>
      )}

      {showRequestForm && (
        <form onSubmit={handleRequest} className="space-y-3 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
          <p className="text-sm font-medium text-gray-200">Request Access</p>
          <select
            value={reqType}
            onChange={e => setReqType(e.target.value)}
            required
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Select access type...</option>
            <option value="export">Export Data</option>
            <option value="analytics">Analytics Access</option>
            <option value="admin_view">Admin View</option>
            <option value="cycle_access">Cycle Access</option>
            <option value="other">Other</option>
          </select>
          <textarea
            value={reqReason}
            onChange={e => setReqReason(e.target.value)}
            placeholder="Reason for request..."
            required
            rows={3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      )}
    </div>
  );
}
