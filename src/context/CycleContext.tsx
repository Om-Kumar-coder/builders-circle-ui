'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import { useAuth } from './AuthContext';

interface Cycle {
  id: string;
  name: string;
  description?: string;
  state: 'planned' | 'active' | 'paused' | 'closed';
  startDate: string;
  endDate: string;
  participantCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CycleContextType {
  activeCycle: Cycle | null;
  allCycles: Cycle[];
  loading: boolean;
  error: string | null;
  setActiveCycle: (cycle: Cycle | null) => void;
  refreshCycles: () => Promise<void>;
}

const CycleContext = createContext<CycleContextType | undefined>(undefined);

export function CycleProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [allCycles, setAllCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshCycles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const cycles = await apiClient.getCycles();
      setAllCycles(cycles);
      
      // Auto-select the first active cycle, or the most recent cycle if none are active
      const activeCycles = cycles.filter((c: Cycle) => c.state === 'active');
      const selectedCycle = activeCycles.length > 0 
        ? activeCycles[0] 
        : cycles.length > 0 
        ? cycles[0] 
        : null;
      
      if (selectedCycle) {
        setActiveCycle(selectedCycle);
      }
      
      console.log('🔄 Cycles loaded:', { 
        total: cycles.length, 
        active: activeCycles.length, 
        selected: selectedCycle?.name,
      });
    } catch (err) {
      console.error('Error fetching cycles:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch cycles');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authLoading && user) {
      refreshCycles();
    } else if (!authLoading && !user) {
      // Reset cycle state when user logs out
      setActiveCycle(null);
      setAllCycles([]);
      setLoading(false);
    }
  }, [user, authLoading, refreshCycles]);

  return (
    <CycleContext.Provider
      value={{
        activeCycle,
        allCycles,
        loading,
        error,
        setActiveCycle,
        refreshCycles,
      }}
    >
      {children}
    </CycleContext.Provider>
  );
}

export function useCycle() {
  const context = useContext(CycleContext);
  if (context === undefined) {
    throw new Error('useCycle must be used within a CycleProvider');
  }
  return context;
}