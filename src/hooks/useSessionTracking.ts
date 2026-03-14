'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';

const HEARTBEAT_INTERVAL = 2 * 60 * 1000; // 2 minutes
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function useSessionTracking() {
  const { user } = useAuth();
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const idleTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastActivity = useRef<number>(0);
  const sessionActive = useRef<boolean>(false);

  const getCurrentPage = () => {
    if (typeof window === 'undefined') return '/';
    return window.location.pathname;
  };

  const startSession = async () => {
    if (!user || sessionActive.current) return;

    try {
      await apiClient.startSession(getCurrentPage());
      sessionActive.current = true;
      console.log('📊 Session started');
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  const sendHeartbeat = async () => {
    if (!user || !sessionActive.current) return;

    try {
      await apiClient.sendHeartbeat(getCurrentPage());
      console.log('💓 Heartbeat sent');
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  };

  const endSession = async () => {
    if (!user || !sessionActive.current) return;

    try {
      await apiClient.endSession();
      sessionActive.current = false;
      console.log('📊 Session ended');
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  const resetIdleTimer = () => {
    lastActivity.current = Date.now();
    
    if (idleTimeout.current) {
      clearTimeout(idleTimeout.current);
    }

    idleTimeout.current = setTimeout(() => {
      console.log('💤 User idle, ending session');
      endSession();
    }, IDLE_TIMEOUT);
  };

  const handleActivity = () => {
    resetIdleTimer();
    
    // Start session if not active
    if (user && !sessionActive.current) {
      startSession();
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Page is hidden, end session
      endSession();
    } else {
      // Page is visible, start session
      if (user) {
        startSession();
      }
    }
  };

  const handleBeforeUnload = () => {
    endSession();
  };

  useEffect(() => {
    if (!user) {
      // Clean up if user logs out
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
      if (idleTimeout.current) {
        clearTimeout(idleTimeout.current);
        idleTimeout.current = null;
      }
      sessionActive.current = false;
      return;
    }

    // Start session when user is available
    startSession();

    // Set up heartbeat interval
    heartbeatInterval.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Set up activity listeners
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Set up visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up beforeunload listener
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Initial idle timer
    resetIdleTimer();

    // Cleanup
    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      if (idleTimeout.current) {
        clearTimeout(idleTimeout.current);
      }

      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return {
    isTracking: sessionActive.current,
    startSession,
    endSession,
  };
}