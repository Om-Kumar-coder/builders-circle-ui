'use client';

import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

export default function GatekeeperLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, is2FAVerified } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) { router.replace('/login'); return; }
      if (user.twoFactorEnabled && !is2FAVerified) { router.replace('/login'); return; }
      if (!user.onboardingCompleted) { router.replace('/onboarding'); return; }
      if (!['gatekeeper', 'admin', 'founder'].includes(user.role ?? '')) {
        router.replace('/dashboard');
      }
    }
  }, [user, loading, router, is2FAVerified]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-violet-500 animate-spin" />
      </div>
    );
  }

  if (!user || !['gatekeeper', 'admin', 'founder'].includes(user.role ?? '')) return null;

  return <>{children}</>;
}
