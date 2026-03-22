'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { Notification } from '@/lib/notifications';

export type ThreatLevel = 'critical' | 'warning';

export interface ThreatAlert {
  id: string;
  level: ThreatLevel;
  message: string;
  timestamp: string;
  eventType: string;
  /** Raw notification for marking read */
  notificationId: string;
}

// Map security event types to threat levels and human-readable messages
function classifyAlert(n: Notification): ThreatAlert | null {
  if (n.type !== 'security_alert') return null;

  const meta = n.metadata ?? {};
  const eventType = (meta.eventType as string) ?? '';

  let level: ThreatLevel = 'warning';
  let message = n.message;

  if (eventType === 'new_device') {
    level = 'critical';
    message = `Suspicious login detected from a new device.${meta.ip ? ` IP: ${meta.ip}` : ''}`;
  } else if (eventType === 'new_login') {
    level = 'warning';
    message = `Login from a new location detected.${meta.ip ? ` IP: ${meta.ip}` : ''}`;
  } else if (eventType === 'password_changed') {
    level = 'critical';
    message = 'Your password was changed. If this wasn\'t you, contact support immediately.';
  } else if (eventType === '2fa_disabled') {
    level = 'critical';
    message = 'Two-factor authentication was disabled on your account.';
  } else if (eventType === 'access_misuse') {
    level = 'critical';
    message = 'Access misuse detected on your account.';
  } else if (eventType === 'access_expired') {
    level = 'warning';
    message = 'Your access has expired and has been blocked.';
  }

  return {
    id: n.id,
    level,
    message,
    timestamp: n.createdAt,
    eventType,
    notificationId: n.id,
  };
}

export function useThreatAlerts() {
  const [alerts, setAlerts] = useState<ThreatAlert[]>([]);

  const fetchAlerts = useCallback(async () => {
    try {
      const notifications: Notification[] = await apiClient.getNotifications();
      const threats = notifications
        .filter(n => n.type === 'security_alert' && !n.read)
        .map(classifyAlert)
        .filter((a): a is ThreatAlert => a !== null);
      setAlerts(threats);
    } catch {
      // silently fail — don't break the UI
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60_000); // re-poll every minute
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const dismiss = useCallback(async (alertId: string) => {
    // Optimistic remove
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    try {
      await apiClient.dismissThreatAlert(alertId);
    } catch {
      // If it fails, re-fetch to restore accurate state
      fetchAlerts();
    }
  }, [fetchAlerts]);

  return { alerts, dismiss, refetch: fetchAlerts };
}
