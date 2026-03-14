'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '../../context/AuthContext';
import { CycleProvider } from '../../context/CycleContext';
import ErrorBoundary from '../error/ErrorBoundary';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CycleProvider>
          {children}
        </CycleProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
