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
import { RefreshCw, Users, CloudDownload } from 'lucide-react';

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
      await approveSubmission(s.id, role);
      setSuccessMsg(`Approved — invite sent to ${s.email}`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setAssigning(null);
      refresh(tab);
    } catch (e: unknown) {
      setApproveError(e instanceof Error ? e.message : 'Approval failed. Please try again.');
    } finally {
      setApproving(false);
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
          <div className="bg-green-900/20 border border-green-800/50 text-green-400 px-4 py-3 rounded-lg text-sm">
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
