'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useIdeas } from '@/hooks/useIdeas';
import IdeaCard from '@/components/ideas/IdeaCard';
import IdeaDetailModal from '@/components/ideas/IdeaDetailModal';
import ApproveIdeaModal from '@/components/ideas/ApproveIdeaModal';
import RejectIdeaModal from '@/components/ideas/RejectIdeaModal';
import type { Idea } from '@/hooks/useIdeas';
import { Lightbulb, RefreshCw } from 'lucide-react';

const TABS = ['All', 'PENDING', 'APPROVED', 'REJECTED'] as const;

export default function AdminIdeasPage() {
  const { loading: authLoading } = useAuth();
  const { isAdmin } = usePermissions();
  const { ideas, loading, fetchAdminIdeas, approveIdea, rejectIdea } = useIdeas();
  const [tab, setTab] = useState<typeof TABS[number]>('All');
  const [viewing, setViewing] = useState<Idea | null>(null);
  const [approving, setApproving] = useState<Idea | null>(null);
  const [rejecting, setRejecting] = useState<Idea | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isAdmin) fetchAdminIdeas(tab === 'All' ? undefined : tab);
  }, [isAdmin, tab, fetchAdminIdeas]);

  async function handleApprove(options: { cycleName?: string; startDate: string; endDate: string }) {
    if (!approving) return;
    await approveIdea(approving.id, options);
    setSuccessMsg('Idea approved. Build cycle created.');
    setTimeout(() => setSuccessMsg(''), 4000);
    setApproving(null);
    fetchAdminIdeas(tab === 'All' ? undefined : tab);
  }

  async function handleReject(note?: string) {
    if (!rejecting) return;
    await rejectIdea(rejecting.id, note);
    setSuccessMsg('Idea rejected.');
    setTimeout(() => setSuccessMsg(''), 3000);
    setRejecting(null);
    fetchAdminIdeas(tab === 'All' ? undefined : tab);
  }

  if (authLoading) return <LoadingScreen />;
  if (!isAdmin) return (
    <MainLayout title="Ideas">
      <p className="text-gray-400">Access denied.</p>
    </MainLayout>
  );

  return (
    <MainLayout title="Idea Review">
      <div className="space-y-6">
        {viewing && !approving && !rejecting && (
          <IdeaDetailModal
            idea={viewing}
            onClose={() => setViewing(null)}
            onApprove={() => { setApproving(viewing); setViewing(null); }}
            onReject={() => { setRejecting(viewing); setViewing(null); }}
          />
        )}
        {approving && (
          <ApproveIdeaModal
            ideaTitle={approving.title}
            onConfirm={handleApprove}
            onClose={() => setApproving(null)}
          />
        )}
        {rejecting && (
          <RejectIdeaModal
            ideaTitle={rejecting.title}
            onConfirm={handleReject}
            onClose={() => setRejecting(null)}
          />
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lightbulb className="w-7 h-7 text-yellow-400" />
            <h1 className="text-2xl font-bold text-gray-100">Idea Review</h1>
          </div>
          <button
            onClick={() => fetchAdminIdeas(tab === 'All' ? undefined : tab)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {successMsg && <div className="bg-green-900/20 border border-green-800/50 text-green-400 px-4 py-3 rounded-lg">{successMsg}</div>}

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

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500" />
          </div>
        ) : ideas.length === 0 ? (
          <div className="text-center py-12">
            <Lightbulb className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No ideas found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ideas.map(idea => (
              <IdeaCard key={idea.id} idea={idea} onClick={() => setViewing(idea)} />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
