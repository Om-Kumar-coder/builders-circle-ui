'use client';

import { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useTriage } from '@/hooks/useTriage';
import TriageTable from '@/components/triage/TriageTable';
import TriageDetailModal from '@/components/triage/TriageDetailModal';
import RejectModal from '@/components/triage/RejectModal';
import AssignModal from '@/components/triage/AssignModal';
import type { TriageSubmission } from '@/hooks/useTriage';
import { RefreshCw, Users, CloudDownload, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const TABS = ['All', 'PENDING', 'APPROVED', 'REJECTED'] as const;
type Tab = typeof TABS[number];

export default function AdminTriagePage() {
  const { loading: authLoading } = useAuth();
  const { isAdmin } = usePermissions();
  const { submissions, loading, fetchTriageList, approveSubmission, rejectSubmission, syncSheet } = useTriage();

  const [tab, setTab] = useState<Tab>('All');
  const [viewing, setViewing] = useState<TriageSubmission | null>(null);
  const [assigning, setAssigning] = useState<TriageSubmission | null>(null);
  const [rejecting, setRejecting] = useState<TriageSubmission | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [overrideModal, setOverrideModal] = useState<{ submission: TriageSubmission; role: string } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState('');

  const refresh = useCallback((t: Tab) => {
    fetchTriageList(t === 'All' ? undefined : t);
  }, [fetchTriageList]);

  // On load: sync sheet first, then fetch list
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setSyncing(true);
      try {
        const result = await syncSheet();
        if (result.imported > 0) {
          setSyncMsg(`${result.imported} new application${result.imported > 1 ? 's' : ''} pulled from the form`);
          setTimeout(() => setSyncMsg(''), 5000);
        }
      } catch {
        // silent — sheet may not be configured yet
      } finally {
        setSyncing(false);
      }
      refresh('All');
    })();
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isAdmin) refresh(tab);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSync() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const result = await syncSheet();
      const msg = result.imported > 0
        ? `${result.imported} new application${result.imported > 1 ? 's' : ''} pulled from the form`
        : 'No new entries';
      setSyncMsg(msg);
      setTimeout(() => setSyncMsg(''), 5000);
      refresh(tab);
    } catch (e: unknown) {
      setSyncMsg(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function handleApprove(s: TriageSubmission, role: string) {
    setApproving(true);
    setApproveError('');
    try {
      const result = await approveSubmission(s.id, role);
      const msg = result?.missingReview
        ? `Approved — invite sent to ${s.email}. ⚠️ This application had no Veronica scan on record.`
        : `Approved — invite sent to ${s.email}`;
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), result?.missingReview ? 8000 : 4000);
      setAssigning(null);
      refresh(tab);
    } catch (e: unknown) {
      const err = e as any;
      if (err?.requiresOverride) {
        setAssigning(null);
        setOverrideModal({ submission: s, role });
        setOverrideError('');
        return;
      }
      setApproveError(err instanceof Error ? err.message : 'Approval failed. Please try again.');
    } finally {
      setApproving(false);
    }
  }

  async function handleOverrideApprove() {
    if (!overrideModal || overrideReason.trim().length < 10) return;
    setOverrideLoading(true);
    setOverrideError('');
    try {
      const result = await apiClient.approveTriageSubmissionWithOverride(overrideModal.submission.id, overrideModal.role, overrideReason);
      const msg = result?.missingReview
        ? `Approved (override) — invite sent to ${overrideModal.submission.email}. ⚠️ No Veronica scan on record.`
        : `Approved (override) — invite sent to ${overrideModal.submission.email}`;
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), result?.missingReview ? 8000 : 4000);
      setOverrideModal(null);
      setOverrideReason('');
      refresh(tab);
    } catch (e: unknown) {
      setOverrideError(e instanceof Error ? e.message : 'Override failed');
    } finally {
      setOverrideLoading(false);
    }
  }

  async function handleReject(s: TriageSubmission, note?: string) {
    await rejectSubmission(s.id, note);
    setSuccessMsg('Application rejected.');
    setTimeout(() => setSuccessMsg(''), 3000);
    setRejecting(null);
    setViewing(null);
    refresh(tab);
  }

  if (authLoading) return <LoadingScreen />;
  if (!isAdmin) return (
    <MainLayout title="Triage">
      <p className="text-gray-400">Access denied.</p>
    </MainLayout>
  );

  return (
    <MainLayout title="Triage Applications">
      <div className="space-y-6">
        {viewing && (
          <TriageDetailModal
            submission={viewing}
            onClose={() => setViewing(null)}
            onApprove={() => { setViewing(null); setAssigning(viewing); }}
            onReject={() => { setViewing(null); setRejecting(viewing); }}
          />
        )}
        {assigning && (
          <AssignModal
            submission={assigning}
            loading={approving}
            error={approveError}
            onConfirm={(role) => handleApprove(assigning, role)}
            onClose={() => { setAssigning(null); setApproveError(''); }}
          />
        )}
        {rejecting && (
          <RejectModal
            title={`Reject application from ${rejecting.name}`}
            onConfirm={(note) => handleReject(rejecting, note)}
            onClose={() => setRejecting(null)}
          />
        )}

        {/* Gatekeeper override modal */}
        {overrideModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-red-800/50 rounded-2xl w-full max-w-md">
              <div className="p-5 border-b border-gray-700">
                <div className="flex items-center gap-2 text-red-400 mb-1">
                  <AlertTriangle className="w-5 h-5" />
                  <h2 className="font-semibold">Gatekeeper Override Required</h2>
                </div>
                <p className="text-sm text-gray-400">
                  This application has been <span className="text-red-400 font-medium">flagged or rejected</span> by the gatekeeper.
                  To approve anyway, provide a reason.
                </p>
              </div>
              <div className="p-5 space-y-3">
                <label className="block text-xs text-gray-400 mb-1">Override Reason (min 10 characters)</label>
                <textarea
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  rows={3}
                  placeholder="Explain why you are overriding the gatekeeper decision..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 resize-none"
                />
                {overrideError && <p className="text-red-400 text-sm">{overrideError}</p>}
              </div>
              <div className="flex gap-3 p-5 border-t border-gray-700">
                <button
                  onClick={() => { setOverrideModal(null); setOverrideReason(''); setOverrideError(''); }}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOverrideApprove}
                  disabled={overrideReason.trim().length < 10 || overrideLoading}
                  className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {overrideLoading ? 'Overriding...' : 'Override & Approve'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-7 h-7 text-indigo-400" />
            <h1 className="text-2xl font-bold text-gray-100">Triage Applications</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              title="Pull new entries from the Google Form"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-700/40 rounded-lg text-indigo-300 transition-colors disabled:opacity-50"
            >
              <CloudDownload className={`w-4 h-4 ${syncing ? 'animate-pulse' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Form'}
            </button>
            <button
              onClick={() => refresh(tab)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {syncMsg && (
          <div className="bg-indigo-900/20 border border-indigo-800/50 text-indigo-300 px-4 py-3 rounded-lg text-sm">
            {syncMsg}
          </div>
        )}
        {successMsg && (
          <div className={`px-4 py-3 rounded-lg text-sm border ${
            successMsg.includes('⚠️')
              ? 'bg-amber-900/20 border-amber-800/50 text-amber-300'
              : 'bg-green-900/20 border-green-800/50 text-green-400'
          }`}>
            {successMsg}
          </div>
        )}

        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          ) : (
            <TriageTable
              submissions={submissions}
              onView={setViewing}
              onApprove={s => setAssigning(s)}
              onReject={s => setRejecting(s)}
            />
          )}
        </div>
      </div>
    </MainLayout>
  );
}
