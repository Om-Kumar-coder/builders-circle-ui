'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  createdAt: string;
  _count?: { users: number; tasks: number };
}

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getGroups();
      setGroups(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  }, []);

  const createGroup = useCallback(async (data: { name: string; description?: string; isDefault?: boolean }) => {
    return apiClient.createGroup(data);
  }, []);

  const updateGroup = useCallback(async (id: string, data: { name?: string; description?: string; isDefault?: boolean }) => {
    return apiClient.updateGroup(id, data);
  }, []);

  const deleteGroup = useCallback(async (id: string) => {
    return apiClient.deleteGroup(id);
  }, []);

  const assignUserGroup = useCallback(async (userId: string, groupId: string | null) => {
    return apiClient.assignUserGroup(userId, groupId);
  }, []);

  const fetchMyGroup = useCallback(async () => {
    return apiClient.getMyGroup();
  }, []);

  return { groups, loading, error, fetchGroups, createGroup, updateGroup, deleteGroup, assignUserGroup, fetchMyGroup };
}
