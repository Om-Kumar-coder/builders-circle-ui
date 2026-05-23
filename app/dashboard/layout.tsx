'use client';

import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, is2FAVerified } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    } else if (!loading && user && user.twoFactorEnabled && !is2FAVerified) {
      router.replace('/login');
    } else if (!loading && user && !user.onboardingCompleted) {
      router.replace('/onboarding');
    }
  }, [user, loading, router, is2FAVerified]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !user.onboardingCompleted || (user.twoFactorEnabled && !is2FAVerified)) {
    return null;
  }

  return <>{children}</>;
}
