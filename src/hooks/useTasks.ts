'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { TaskAssignment } from '@/types/task';

export function useMyTasks() {
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getMyTasks();
      setTasks(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const completeTask = async (taskId: string) => {
    await apiClient.completeTask(taskId);
    await fetch();
  };

  const startTask = async (taskId: string) => {
    await apiClient.startTask(taskId);
    await fetch();
  };

  return { tasks, loading, error, refetch: fetch, completeTask, startTask };
}
