'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface TriageSubmission {
  id: string;
  name: string;
  email: string;
  roleType: string;
  submissionType: string;
  description: string;
  proofLinks?: string[];
  availability?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionNote?: string | null;
  createdAt: string;
}

export function useTriage() {
  const [submissions, setSubmissions] = useState<TriageSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitTriage = useCallback(async (data: {
    name: string;
    email: string;
    roleType: string;
    submissionType: string;
    description: string;
    proofLinks?: string[];
    availability?: string;
  }) => {
    return apiClient.submitTriage(data);
  }, []);

  const fetchTriageList = useCallback(async (status?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getTriageList(status);
      setSubmissions(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch submissions');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTriageDetail = useCallback(async (id: string) => {
    return apiClient.getTriageDetail(id);
  }, []);

  const approveSubmission = useCallback(async (id: string, role?: string) => {
    return apiClient.approveTriageSubmission(id, role);
  }, []);

  const rejectSubmission = useCallback(async (id: string, note?: string) => {
    return apiClient.rejectTriageSubmission(id, note);
  }, []);

  const syncSheet = useCallback(async () => {
    return apiClient.syncSheet();
  }, []);

  return { submissions, loading, error, submitTriage, fetchTriageList, fetchTriageDetail, approveSubmission, rejectSubmission, syncSheet };
}
