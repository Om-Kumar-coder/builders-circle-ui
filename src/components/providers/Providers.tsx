'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '../../context/AuthContext';
import { CycleProvider } from '../../context/CycleContext';
import ErrorBoundary from '../error/ErrorBoundary';
import ForceReAuthModal from '../auth/ForceReAuthModal';
import SessionWarningModal from '../auth/SessionWarningModal';
import AgreementGate from '../agreements/AgreementGate';

const AUTH_PAGES = ['/login', '/signup', '/verify-email', '/setup-2fa', '/onboarding', '/submit-to-triage'];

function AppModals() {
  const pathname = usePathname();
  const isAuthPage = AUTH_PAGES.some(p => pathname?.startsWith(p));
  if (isAuthPage) return null;
  return (
    <>
      <ForceReAuthModal />
      <SessionWarningModal />
    </>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CycleProvider>
          <AgreementGate>
            {children}
          </AgreementGate>
          <AppModals />
        </CycleProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
