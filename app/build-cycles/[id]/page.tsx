'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import type { BuildCycle } from '@/types/cycle';
import type { ParticipationRecord } from '@/lib/participation';
import { getParticipation } from '@/lib/participation';
import MainLayout from '@/components/layout/MainLayout';
import CycleDetails from '@/components/cycles/CycleDetails';
import SubmitActivityForm from '@/components/activity/SubmitActivityForm';
import ActivityTimeline from '@/components/activity/ActivityTimeline';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CycleDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [cycle, setCycle] = useState<BuildCycle | null>(null);
  const [participation, setParticipation] = useState<ParticipationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const cycleId = params.id as string;

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch cycle details
      const cycleDoc = await apiClient.getCycle(cycleId);
      setCycle(cycleDoc as BuildCycle);

      // Fetch user participation
      const participationData = await getParticipation(user.$id, cycleId);
      setParticipation(participationData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch cycle details');
    } finally {
      setLoading(false);
    }
  };

  const handleActivitySubmitted = () => {
    setRefreshTrigger(prev => prev + 1);
    fetchData();
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, cycleId]);

  if (authLoading || loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  if (error) {
    return (
      <MainLayout title="Cycle Details">
        <div className="animate-in fade-in duration-300">
          <Link
            href="/build-cycles"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Build Cycles</span>
          </Link>
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-6 py-4 rounded-lg">
            {error}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!cycle) {
    return (
      <MainLayout title="Cycle Details">
        <div className="animate-in fade-in duration-300 text-center">
          <p className="text-gray-400 mb-4">Cycle not found</p>
          <Link
            href="/build-cycles"
            className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Build Cycles</span>
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={cycle.name}>
      <div className="animate-in fade-in duration-300">
        <Link
          href="/build-cycles"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Build Cycles</span>
        </Link>

        <CycleDetails
          cycle={cycle}
          user={user}
          participation={participation}
          onUpdate={fetchData}
        />

        {/* Activity Submission - Only show if user is participating and cycle is active */}
        {participation && participation.optedIn && cycle.state === 'active' && (
          <div className="mt-6">
            <SubmitActivityForm
              userId={user.$id}
              cycleId={cycle.id}
              onSuccess={handleActivitySubmitted}
            />
          </div>
        )}

        {/* Activity Timeline - Show if user is participating */}
        {participation && participation.optedIn && (
          <div className="mt-6">
            <ActivityTimeline
              userId={user.$id}
              cycleId={cycle.id}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}
      </div>
    </MainLayout>
  );
}
