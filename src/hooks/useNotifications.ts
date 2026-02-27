'use client';

import { useState, useEffect, useCallback } from 'react';
import { getUserNotifications, getUnreadCount, markAsRead, markAllAsRead, type Notification } from '@/lib/notifications';

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useNotifications(userId: string, autoRefresh: boolean = true): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      const [notifs, count] = await Promise.all([
        getUserNotifications(userId, 20),
        getUnreadCount(userId),
      ]);

      setNotifications(notifs);
      setUnreadCount(count);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const markRead = useCallback(async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
      
      // Update local state
      setNotifications(prev =>
        prev.map(n => n.$id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error('Error marking notification as read:', err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await markAllAsRead(userId);
      
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err: any) {
      console.error('Error marking all as read:', err);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();

    if (autoRefresh) {
      // Refresh every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchNotifications, autoRefresh]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refetch: fetchNotifications,
    markRead,
    markAllRead,
  };
}
