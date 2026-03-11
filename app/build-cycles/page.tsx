'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCycles } from '@/hooks/useCycles';
import MainLayout from '@/components/layout/MainLayout';
import CycleCard from '@/components/cycles/CycleCard';
import CycleCardSkeleton from '@/components/cycles/CycleCardSkeleton';
import CreateCycleModal from '@/components/cycles/CreateCycleModal';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { Zap } from 'lucide-react';

export default function BuildCyclesPage() {
  const { user, loading: authLoading } = useAuth();
  const { cycles, loading: cyclesLoading, error, refetch } = useCycles();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'founder';

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <MainLayout title="Build Cycles">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400">Please log in to view build cycles.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Build Cycles">
      <div className="animate-in fade-in duration-300">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-100">Build Cycles</h1>
            <p className="text-gray-400 mt-1">Manage and track build cycles for the Builder's Circle</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Create Cycle
            </button>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Cycles Grid */}
        {cyclesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <CycleCardSkeleton key={i} />
            ))}
          </div>
        ) : cycles.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4 opacity-50">📅</div>
            <h2 className="text-xl font-semibold text-gray-200 mb-2">No Build Cycles Yet</h2>
            <p className="text-gray-400 mb-6">
              {isAdmin
                ? 'Create your first build cycle to get started.'
                : 'Check back later for upcoming build cycles.'}
            </p>
            {isAdmin && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium inline-flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Create First Cycle
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cycles.map((cycle) => (
              <CycleCard key={cycle.id} cycle={cycle} userId={user?.id} />
            ))}
          </div>
        )}
      </div>

      {/* Create Cycle Modal */}
      <CreateCycleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={refetch}
      />
    </MainLayout>
  );
}
