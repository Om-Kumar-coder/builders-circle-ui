'use client';

import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import IdeaSubmitForm from '@/components/ideas/IdeaSubmitForm';
import { Lightbulb } from 'lucide-react';

export default function SubmitIdeaPage() {
  const { loading: authLoading } = useAuth();
  const { can } = usePermissions();
  const router = useRouter();

  if (authLoading) return <LoadingScreen />;
  if (!can('ideas:submit')) return (
    <MainLayout title="Submit Idea">
      <p className="text-gray-400">You don't have permission to submit ideas.</p>
    </MainLayout>
  );

  return (
    <MainLayout title="Submit Idea">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Lightbulb className="w-7 h-7 text-yellow-400" />
          <h1 className="text-2xl font-bold text-gray-100">Submit an Idea</h1>
        </div>
        <p className="text-gray-400">Propose a new build cycle. Approved ideas become planned cycles with you as the lead.</p>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <IdeaSubmitForm onSuccess={() => router.push('/ideas')} />
        </div>
      </div>
    </MainLayout>
  );
}
