'use client';

import { useAuth } from '../../src/context/AuthContext';
import MainLayout from "../../src/components/layout/MainLayout";
import DashboardGrid from "../../src/components/dashboard/DashboardGrid";

export default function Page() {
  const { user } = useAuth();
  
  // TODO: Replace with actual user ID and cycle ID from auth/context
  const userId = user?.$id || "user123";
  const cycleId = "cycle456";

  return (
    <MainLayout title="Dashboard">
      <DashboardGrid userId={userId} cycleId={cycleId} />
    </MainLayout>
  );
}
