'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import MainLayout from '@/components/layout/MainLayout';
import CycleDetails from '@/components/cycles/CycleDetails';
import LoadingScreen from '@/components/auth/LoadingScreen';
import ErrorState from '@/components/dashboard/ErrorState';
import type { BuildCycle } from '@/types/cycle';

export default function CycleDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const [cycle, setCycle] = useState<BuildCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cycleId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    const fetchCycle = async () => {
      try {
        setLoading(true);
        setError(null);
        const cycleData = await apiClient.getCycle(cycleId!);
        setCycle(cycleData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cycle details');
      } finally {
        setLoading(false);
      }
    };

    if (cycleId) {
      fetchCycle();
    }
  }, [cycleId]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <MainLayout title="Cycle Details">
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </MainLayout>
    );
  }

  if (!cycle) {
    return (
      <MainLayout title="Cycle Details">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-100 mb-2">Cycle Not Found</h2>
          <p className="text-gray-400">The requested build cycle could not be found.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={cycle.name}>
      <CycleDetails cycle={cycle} userId={user?.id} />
    </MainLayout>
  );
}