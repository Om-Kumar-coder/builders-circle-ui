'use client';

import { useAuth } from '../../src/context/AuthContext';
import { useCycle } from '../../src/context/CycleContext';
import MainLayout from "../../src/components/layout/MainLayout";
import DashboardGrid from "../../src/components/dashboard/DashboardGrid";
import StallWarningAlert from "../../src/components/dashboard/StallWarningAlert";

export default function Page() {
  const { user } = useAuth();
  const { activeCycle, loading: cycleLoading } = useCycle();
  
  if (cycleLoading) {
    return (
      <MainLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </MainLayout>
    );
  }

  if (!activeCycle) {
    return (
      <MainLayout title="Dashboard">
        <div className="text-center py-12">
          <div className="text-5xl mb-4 opacity-50">🚀</div>
          <h2 className="text-xl font-semibold text-gray-100 mb-2">No Active Cycles</h2>
          <p className="text-gray-400 mb-6">There are no build cycles available at the moment.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Dashboard">
      <div className="space-y-6">
        {/* Stall Warning Alerts */}
        <StallWarningAlert />
        
        {/* Main Dashboard */}
        <DashboardGrid userId={user?.id || ""} cycleId={activeCycle.id} />
      </div>
    </MainLayout>
  );
}
