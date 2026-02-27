import { databases } from './appwrite';
import { ID, Query, Models } from 'appwrite';

export interface Notification extends Models.Document {
  userId: string;
  type: 'stall_warning' | 'participation_paused' | 'activity_verified' | 'multiplier_changed' | 'cycle_started' | 'admin_message';
  message: string;
  read: boolean;
  metadata?: Record<string, any>;
}

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '';
const NOTIFICATIONS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID || 'notifications';

/**
 * Create a new notification
 */
export async function createNotification(
  userId: string,
  type: Notification['type'],
  message: string,
  metadata?: Record<string, any>
): Promise<Notification> {
  try {
    const notification = await databases.createDocument(
      DATABASE_ID,
      NOTIFICATIONS_COLLECTION_ID,
      ID.unique(),
      {
        userId,
        type,
        message,
        read: false,
        metadata: metadata || {},
        createdAt: new Date().toISOString(),
      }
    );

    return notification as Notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
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
    const queries = [
      Query.equal('userId', userId),
      Query.orderDesc('$createdAt'),
      Query.limit(limit),
    ];

    if (unreadOnly) {
      queries.push(Query.equal('read', false));
    }

    const response = await databases.listDocuments(
      DATABASE_ID,
      NOTIFICATIONS_COLLECTION_ID,
      queries
    );

    return response.documents as Notification[];
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
    const response = await databases.listDocuments(
      DATABASE_ID,
      NOTIFICATIONS_COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.equal('read', false),
      ]
    );

    return response.total;
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
    await databases.updateDocument(
      DATABASE_ID,
      NOTIFICATIONS_COLLECTION_ID,
      notificationId,
      { read: true }
    );
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
      notifications.map(notification => markAsRead(notification.$id))
    );
  } catch (error) {
    console.error('Error marking all as read:', error);
    throw error;
  }
}

/**
 * Delete old notifications (cleanup)
 */
export async function deleteOldNotifications(userId: string, daysOld: number = 30): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const response = await databases.listDocuments(
      DATABASE_ID,
      NOTIFICATIONS_COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.lessThan('$createdAt', cutoffDate.toISOString()),
      ]
    );

    await Promise.all(
      response.documents.map(doc => 
        databases.deleteDocument(DATABASE_ID, NOTIFICATIONS_COLLECTION_ID, doc.$id)
      )
    );
  } catch (error) {
    console.error('Error deleting old notifications:', error);
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
  // TODO: Implement email notification via Appwrite Functions
  // This will use an email service provider (SendGrid, Mailgun, etc.)
  console.log('Email notification placeholder:', { userId, type, message });
  
  // Future implementation:
  // 1. Get user email from user profile
  // 2. Format email template based on notification type
  // 3. Call Appwrite Function to send email
  // 4. Log email sent event
}
