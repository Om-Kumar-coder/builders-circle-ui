'use client';

import { useState, useCallback, useMemo } from 'react';

export interface FilterState {
  startDate: string;
  endDate: string;
  userId: string;
  type: string;
  search: string;
  status: string;
}

const DEFAULT_FILTERS: FilterState = {
  startDate: '',
  endDate: '',
  userId: '',
  type: '',
  search: '',
  status: '',
};

export function useFilters(initial?: Partial<FilterState>) {
  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS, ...initial });

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS, ...initial });
  }, [initial]);

  const hasActiveFilters = useMemo(() =>
    Object.entries(filters).some(([, v]) => v !== ''),
    [filters]
  );

  const toQueryParams = useCallback(() => {
    const params: Record<string, string> = {};
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (filters.userId) params.userId = filters.userId;
    if (filters.type) params.type = filters.type;
    if (filters.status) params.status = filters.status;
    return params;
  }, [filters]);

  return { filters, setFilter, resetFilters, hasActiveFilters, toQueryParams };
}
