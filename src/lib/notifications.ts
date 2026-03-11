import { apiClient } from './api-client';

export interface Notification {
  id: string;
  userId: string;
  type: 'stall_warning' | 'participation_paused' | 'activity_verified' | 'multiplier_changed' | 'cycle_started' | 'admin_message';
  message: string;
  read: boolean;
  metadata?: string;
  createdAt: string;
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(
  userId: string,
  limit: number = 20,
  unreadOnly: boolean = false
): Promise<Notification[]> {
  try {
    const notifications = await apiClient.getNotifications();
    
    let filtered = notifications;
    if (unreadOnly) {
      filtered = notifications.filter((n: Notification) => !n.read);
    }
    
    return filtered.slice(0, limit);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const notifications = await apiClient.getNotifications();
    return notifications.filter((n: Notification) => !n.read).length;
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string): Promise<void> {
  try {
    await apiClient.markNotificationAsRead(notificationId);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<void> {
  try {
    const notifications = await getUserNotifications(userId, 100, true);
    
    await Promise.all(
      notifications.map(notification => markAsRead(notification.id))
    );
  } catch (error) {
    console.error('Error marking all as read:', error);
    throw error;
  }
}

/**
 * Get notification icon based on type
 */
export function getNotificationIcon(type: Notification['type']): string {
  switch (type) {
    case 'stall_warning':
      return '⚠️';
    case 'participation_paused':
      return '⏸️';
    case 'activity_verified':
      return '✅';
    case 'multiplier_changed':
      return '⚡';
    case 'cycle_started':
      return '🚀';
    case 'admin_message':
      return '📢';
    default:
      return '🔔';
  }
}

/**
 * Get notification color based on type
 */
export function getNotificationColor(type: Notification['type']): string {
  switch (type) {
    case 'stall_warning':
      return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    case 'participation_paused':
      return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'activity_verified':
      return 'text-green-400 bg-green-500/10 border-green-500/20';
    case 'multiplier_changed':
      return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
    case 'cycle_started':
      return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    case 'admin_message':
      return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
    default:
      return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  }
}

/**
 * Email notification placeholder (future implementation)
 */
export async function sendNotificationEmail(
  userId: string,
  type: Notification['type'],
  message: string
): Promise<void> {
  // TODO: Implement email notification via backend service
  console.log('Email notification placeholder:', { userId, type, message });
}