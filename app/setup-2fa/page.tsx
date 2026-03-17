'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import TwoFactorSetup from '@/components/settings/TwoFactorSetup';

export default function Setup2FAPage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user?.twoFactorEnabled) {
      router.replace(user.role === 'founder' || user.role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  async function handleEnabled() {
    await refreshUser();
    router.replace(user!.role === 'founder' || user!.role === 'admin' ? '/admin' : '/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">Secure your account</h1>
          <p className="text-gray-400 mt-2">
            Two-factor authentication is required to access the app.
          </p>
        </div>
        <TwoFactorSetup
          enabled={false}
          onClose={() => {/* can't dismiss — mandatory */}}
          onToggled={(enabled) => { if (enabled) handleEnabled(); }}
          mandatory
        />
      </div>
    </div>
  );
}
