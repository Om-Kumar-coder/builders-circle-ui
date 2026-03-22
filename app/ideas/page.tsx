'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useIdeas } from '@/hooks/useIdeas';
import IdeaCard from '@/components/ideas/IdeaCard';
import { Lightbulb, Plus } from 'lucide-react';

export default function IdeasPage() {
  const { loading: authLoading } = useAuth();
  const { can } = usePermissions();
  const { ideas, loading, fetchMyIdeas } = useIdeas();
  const router = useRouter();

  useEffect(() => { fetchMyIdeas(); }, [fetchMyIdeas]);

  if (authLoading) return <LoadingScreen />;

  const canSubmit = can('ideas:submit');

  return (
    <MainLayout title="My Ideas">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lightbulb className="w-7 h-7 text-yellow-400" />
            <h1 className="text-2xl font-bold text-gray-100">My Ideas</h1>
          </div>
          {canSubmit && (
            <button
              onClick={() => router.push('/ideas/submit')}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} /> Submit Idea
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500" />
          </div>
        ) : ideas.length === 0 ? (
          <div className="text-center py-16">
            <Lightbulb className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No ideas submitted yet.</p>
            {canSubmit && (
              <button
                onClick={() => router.push('/ideas/submit')}
                className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Submit your first idea
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ideas.map(idea => <IdeaCard key={idea.id} idea={idea} />)}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
