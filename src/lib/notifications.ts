import { apiClient } from './api-client';

export type NotificationType = 
  | 'stall_warning' 
  | 'activity_verified' 
  | 'multiplier_changed' 
  | 'cycle_started' 
  | 'participation_paused' 
  | 'admin_message'
  | 'user_mentioned'
  | 'stall_recovery'
  | 'ownership_decay'
  | 'cycle_finalized';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

export async function getNotifications(unreadOnly = false, limit = 50): Promise<Notification[]> {
  try {
    const notifications = await apiClient.getNotifications();
    
    let filtered: Notification[];
    if (unreadOnly && Array.isArray(notifications)) {
      filtered = notifications.filter((n: Notification) => !n.read);
    } else {
      filtered = notifications || [];
    }
    
    return Array.isArray(filtered) ? filtered.slice(0, limit) : [];
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return [];
  }
}

export async function getUnreadCount(): Promise<number> {
  try {
    const result = await apiClient.getUnreadCount();
    return result.count || 0;
  } catch (error) {
    console.error('Failed to fetch unread count:', error);
    return 0;
  }
}

export async function markAsRead(notificationId: string): Promise<void> {
  try {
    await apiClient.markNotificationRead(notificationId);
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    throw error;
  }
}

export async function markAllAsRead(): Promise<void> {
  try {
    await apiClient.markAllNotificationsRead();
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    throw error;
  }
}

export function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case 'stall_warning':
      return '⚠️';
    case 'activity_verified':
      return '✅';
    case 'multiplier_changed':
      return '📊';
    case 'cycle_started':
      return '🚀';
    case 'participation_paused':
      return '⏸️';
    case 'admin_message':
      return '📢';
    case 'user_mentioned':
      return '💬';
    case 'stall_recovery':
      return '🔄';
    case 'ownership_decay':
      return '📉';
    case 'cycle_finalized':
      return '🏁';
    default:
      return '🔔';
  }
}

export function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case 'stall_warning':
      return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
    case 'activity_verified':
      return 'bg-green-500/10 border-green-500/30 text-green-400';
    case 'multiplier_changed':
      return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
    case 'cycle_started':
      return 'bg-purple-500/10 border-purple-500/30 text-purple-400';
    case 'participation_paused':
      return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
    case 'admin_message':
      return 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400';
    case 'user_mentioned':
      return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400';
    case 'stall_recovery':
      return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
    case 'ownership_decay':
      return 'bg-red-500/10 border-red-500/30 text-red-400';
    case 'cycle_finalized':
      return 'bg-violet-500/10 border-violet-500/30 text-violet-400';
    default:
      return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
  }
}