'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { apiClient } from '@/lib/api-client';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { Zap, AlertTriangle, RefreshCw } from 'lucide-react';

export default function FoundationPhasePage() {
  const { loading: authLoading } = useAuth();
  const { isFounder } = usePermissions();

  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  async function fetchConfig() {
    setLoading(true);
    try {
      const data = await apiClient.getFoundationPhaseConfig();
      setEnabled(data.foundationPhaseEnabled);
    } catch {
      setMessage({ text: 'Failed to load config.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isFounder) fetchConfig();
  }, [isFounder]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggle() {
    setSaving(true);
    setMessage(null);
    try {
      const data = await apiClient.setFoundationPhaseEnabled(!enabled);
      setEnabled(data.foundationPhaseEnabled);
      setMessage({
        text: `Foundation Phase ${data.foundationPhaseEnabled ? 'enabled' : 'disabled'} successfully.`,
        type: 'success',
      });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Failed to update config.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return <LoadingScreen />;

  if (!isFounder) {
    return (
      <MainLayout title="Foundation Phase">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400">Access denied. Founder privileges required.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Foundation Phase">
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
              <Zap className="w-7 h-7 text-yellow-400" />
              Foundation Phase Mode
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              When enabled, activities submitted by founders are auto-approved instantly.
            </p>
          </div>
          <button
            onClick={fetchConfig}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-300/90 space-y-1">
            <p className="font-medium">Founder-only feature</p>
            <p>This toggle only affects founders. All other roles continue to require manual activity approval. All auto-approvals are recorded in the audit trail.</p>
          </div>
        </div>

        {message && (
          <div className={`px-4 py-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-900/20 border border-green-800/50 text-green-400'
              : 'bg-red-900/20 border border-red-800/50 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          {loading ? (
            <div className="flex items-center gap-3 text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading config...
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Foundation Phase</p>
                <p className="text-gray-400 text-sm mt-0.5">
                  Currently: <span className={enabled ? 'text-green-400 font-medium' : 'text-gray-500'}>
                    {enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </p>
              </div>
              <button
                onClick={handleToggle}
                disabled={saving}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 ${
                  enabled ? 'bg-green-600' : 'bg-gray-600'
                }`}
                role="switch"
                aria-checked={enabled}
                aria-label="Toggle Foundation Phase"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <p className="text-sm font-medium text-gray-300">What this does</p>
          <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
            <li>Founder-submitted activities are immediately set to <span className="text-green-400">verified</span></li>
            <li>Ownership is calculated and recorded automatically</li>
            <li>Every auto-approval is logged in the audit trail</li>
            <li>Non-founder activities are unaffected — they still require manual review</li>
            <li>Disabling this restores normal approval flow for founders</li>
          </ul>
        </div>
      </div>
    </MainLayout>
  );
}
