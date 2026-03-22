'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface Idea {
  id: string;
  submittedBy: string;
  title: string;
  description: string;
  attachments?: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionNote?: string | null;
  cycleId?: string | null;
  createdAt: string;
  submitter?: { id: string; name: string | null; email: string };
  cycle?: { id: string; name: string; state: string } | null;
}

export function useIdeas() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitIdea = useCallback(async (data: { title: string; description: string; attachments?: string[] }) => {
    return apiClient.submitIdea(data);
  }, []);

  const fetchMyIdeas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getMyIdeas();
      setIdeas(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch ideas');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAdminIdeas = useCallback(async (status?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getAdminIdeas(status);
      setIdeas(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch ideas');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIdeaDetail = useCallback(async (id: string) => {
    return apiClient.getIdeaDetail(id);
  }, []);

  const approveIdea = useCallback(async (id: string, options: { cycleName?: string; startDate: string; endDate: string }) => {
    return apiClient.approveIdea(id, options);
  }, []);

  const rejectIdea = useCallback(async (id: string, note?: string) => {
    return apiClient.rejectIdea(id, note);
  }, []);

  return { ideas, loading, error, submitIdea, fetchMyIdeas, fetchAdminIdeas, fetchIdeaDetail, approveIdea, rejectIdea };
}
