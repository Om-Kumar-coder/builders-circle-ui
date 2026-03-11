import { apiClient } from './api-client';

export type NotificationType = 
  | 'stall_warning' 
  | 'activity_verified' 
  | 'multiplier_changed' 
  | 'cycle_started' 
  | 'participation_paused' 
  | 'admin_message';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  userId: string;
  metadata?: Record<string, any>;
}

export async function getNotifications(unreadOnly = false, limit = 50): Promise<Notification[]> {
  try {
    const notifications = await apiClient.getNotifications(unreadOnly) as any;
    
    let filtered: any;
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
    const notifications = await apiClient.getNotifications(true) as any;
    return Array.isArray(notifications) ? notifications.filter((n: Notification) => !n.read).length : 0;
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
    default:
      return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
  }
}