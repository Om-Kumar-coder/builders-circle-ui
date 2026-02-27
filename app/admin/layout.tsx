'use client';

import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (user.role !== 'admin' && user.role !== 'founder') {
        router.replace('/dashboard');
      }
    }
  }, [user, loading, router]);

  // Show loading while checking session
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render admin if not logged in or wrong role
  if (!user || (user.role !== 'admin' && user.role !== 'founder')) {
    return null;
  }

  // Just render children - MainLayout will handle header/sidebar
  return <>{children}</>;
}
