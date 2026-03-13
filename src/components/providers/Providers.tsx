'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '../../context/AuthContext';
import { CycleProvider } from '../../context/CycleContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CycleProvider>
        {children}
      </CycleProvider>
    </AuthProvider>
  );
}
