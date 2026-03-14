'use client';

import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { getNotificationIcon, getNotificationColor } from '@/lib/notifications';

interface NotificationWidgetProps {
  userId: string;
}

export default function NotificationWidget({ userId: _userId }: NotificationWidgetProps) {
  const { notifications, unreadCount, loading, markRead } = useNotifications(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const recentNotifications = notifications.slice(0, 3);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-semibold text-gray-100">Recent Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {recentNotifications.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {isExpanded ? 'Show Less' : 'View All'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-gray-800 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-800 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-800 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : recentNotifications.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-2 opacity-50">🔔</div>
          <p className="text-gray-400">No notifications</p>
          <p className="text-sm text-gray-500">You&apos;re all caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(isExpanded ? notifications : recentNotifications).map((notification) => (
            <div
              key={notification.id}
              className={`flex gap-3 p-3 rounded-lg transition-colors ${
                notification.read ? 'hover:bg-gray-800/50' : 'bg-gray-800/70 hover:bg-gray-800'
              }`}
            >
              <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border ${getNotificationColor(notification.type)}`}>
                <span className="text-xl">{getNotificationIcon(notification.type)}</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${notification.read ? 'text-gray-400' : 'text-gray-200 font-medium'}`}>
                  {notification.message}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatTime(notification.createdAt)}
                </p>
              </div>

              {!notification.read && (
                <button
                  onClick={() => markRead(notification.id)}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-200 transition-colors"
                  aria-label="Mark as read"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}