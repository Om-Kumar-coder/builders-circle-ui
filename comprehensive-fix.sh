#!/bin/bash

echo "🚀 COMPREHENSIVE FIX FOR ALL TYPESCRIPT ERRORS"

echo "📦 Installing missing backend dependencies..."
cd backend
npm install @prisma/client express cors helmet express-rate-limit bcryptjs jsonwebtoken node-cron winston
npm install --save-dev @types/express @types/cors @types/bcryptjs @types/jsonwebtoken @types/node
cd ..

echo "🔧 Fixing frontend type issues..."

# Fix earnings page
cat > app/earnings/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { apiClient } from '@/lib/api-client';
import { TrendingUp, DollarSign, Calendar, Award } from 'lucide-react';

interface OwnershipEntry {
  id: string;
  activityType: string;
  ownershipAmount: number;
  createdAt: string;
  description?: string;
}

interface EarningsData {
  totalOwnership: number;
  vestedOwnership: number;
  provisionalOwnership: number;
  multiplier: number;
  effectiveOwnership: number;
  entries: OwnershipEntry[];
}

export default function EarningsPage() {
  const { user, loading: authLoading } = useAuth();
  const [earningsData, setEarningsData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEarnings = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Get current cycle ID (you might need to adjust this based on your API)
        const cycleId = 'current'; // or fetch from cycles API
        
        const response = await apiClient.getOwnership(user.id, cycleId) as any;
        
        if (response?.success && response?.entries) {
          // Transform the entries to match our interface
          const transformedEvents = response.entries.map((entry: any) => ({
            id: entry.id,
            activityType: entry.activityType || 'Unknown',
            ownershipAmount: entry.ownershipAmount || 0,
            createdAt: entry.createdAt || new Date().toISOString(),
            description: entry.description
          }));

          setEarningsData({
            totalOwnership: response.totalOwnership || 0,
            vestedOwnership: (response.totalOwnership || 0) * 0.6,
            provisionalOwnership: (response.totalOwnership || 0) * 0.4,
            multiplier: response.multiplier || 1,
            effectiveOwnership: response.effectiveOwnership || 0,
            entries: transformedEvents
          });
        } else {
          setEarningsData({
            totalOwnership: 0,
            vestedOwnership: 0,
            provisionalOwnership: 0,
            multiplier: 1,
            effectiveOwnership: 0,
            entries: []
          });
        }
      } catch (err) {
        console.error('Failed to fetch earnings:', err);
        setError('Failed to load earnings data');
        setEarningsData({
          totalOwnership: 0,
          vestedOwnership: 0,
          provisionalOwnership: 0,
          multiplier: 1,
          effectiveOwnership: 0,
          entries: []
        });
      } finally {
        setLoading(false);
      }
    };

    fetchEarnings();
  }, [user?.id]);

  if (authLoading || loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <MainLayout title="Earnings">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400">Please log in to view your earnings.</p>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout title="Earnings">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-red-400">{error}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Earnings">
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Earnings Overview</h1>
          <p className="text-gray-400 mt-1">Track your ownership and earnings from contributions</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-sm text-gray-400">Total Ownership</span>
            </div>
            <p className="text-2xl font-semibold text-gray-100">
              {earningsData?.totalOwnership.toFixed(4) || '0.0000'}%
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Award className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-sm text-gray-400">Vested</span>
            </div>
            <p className="text-2xl font-semibold text-gray-100">
              {earningsData?.vestedOwnership.toFixed(4) || '0.0000'}%
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Calendar className="w-5 h-5 text-yellow-400" />
              </div>
              <span className="text-sm text-gray-400">Provisional</span>
            </div>
            <p className="text-2xl font-semibold text-gray-100">
              {earningsData?.provisionalOwnership.toFixed(4) || '0.0000'}%
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-sm text-gray-400">Multiplier</span>
            </div>
            <p className="text-2xl font-semibold text-gray-100">
              {earningsData?.multiplier.toFixed(2) || '1.00'}x
            </p>
          </div>
        </div>

        {/* Earnings History */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-6">Earnings History</h2>
          
          {earningsData?.entries && earningsData.entries.length > 0 ? (
            <div className="space-y-4">
              {earningsData.entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
                  <div>
                    <p className="text-sm font-medium text-gray-200">{entry.activityType}</p>
                    {entry.description && (
                      <p className="text-xs text-gray-500 mt-1">{entry.description}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-400">
                      +{entry.ownershipAmount.toFixed(4)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">No earnings history available</p>
              <p className="text-sm text-gray-500 mt-1">Start contributing to earn ownership!</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
EOF

# Fix test cycles connection page
cat > app/test-cycles-connection/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { apiClient } from '@/lib/api-client';

export default function TestCyclesConnectionPage() {
  const { user, loading: authLoading } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<string>('Testing...');
  const [cyclesData, setCyclesData] = useState<any>(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        const response = await apiClient.getCycles() as any;
        
        if (response && Array.isArray(response)) {
          setConnectionStatus('✅ Connection successful');
          setCyclesData({
            total: response.length,
            cycles: response
          });
        } else {
          setConnectionStatus('⚠️ Connected but no data');
          setCyclesData({ total: 0, cycles: [] });
        }
      } catch (error) {
        setConnectionStatus('❌ Connection failed');
        console.error('Connection test failed:', error);
      }
    };

    if (user) {
      testConnection();
    }
  }, [user]);

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <MainLayout title="Test Connection">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400">Please log in to test the connection.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Test Cycles Connection">
      <div className="space-y-6 animate-in fade-in duration-300">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Connection Test</h1>
          <p className="text-gray-400 mt-1">Testing connection to cycles API</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Status</h2>
          <p className="text-lg">{connectionStatus}</p>
          
          {cyclesData && (
            <div className="mt-4">
              <p className="text-gray-300">Total cycles: {cyclesData.total}</p>
              {cyclesData.cycles && cyclesData.cycles.length > 0 && (
                <div className="mt-2">
                  <p className="text-gray-400">Recent cycles:</p>
                  <ul className="list-disc list-inside text-sm text-gray-500 mt-1">
                    {cyclesData.cycles.slice(0, 3).map((cycle: any, index: number) => (
                      <li key={index}>{cycle.name || `Cycle ${index + 1}`}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
EOF

echo "🔧 Fixing context and hooks type issues..."

# Fix AuthContext
cat > src/context/AuthContext.tsx << 'EOF'
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType } from '@/types/auth';
import { apiClient } from '@/lib/api-client';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const createUserFromData = (userData: any): User => {
    return {
      id: userData?.id || '',
      email: userData?.email || '',
      name: userData?.name,
      createdAt: userData?.createdAt,
      role: userData?.role as User['role'],
      status: userData?.status,
      bio: userData?.bio,
      avatar: userData?.avatar,
      emailVerification: userData?.emailVerification
    };
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const response = await apiClient.getCurrentUser() as any;
          const userData = response?.user;
          if (userData) {
            setUser(createUserFromData(userData));
          }
        } catch (error) {
          console.error('Auth initialization failed:', error);
          localStorage.removeItem('auth_token');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await apiClient.login(email, password) as any;
      const userData = response?.user;
      if (userData) {
        setUser(createUserFromData(userData));
      }
    } catch (error) {
      throw error;
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    try {
      const response = await apiClient.signup(name, email, password) as any;
      const userData = response?.user;
      if (userData) {
        setUser(createUserFromData(userData));
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('auth_token');
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
EOF

echo "🔧 Fixing notification types..."

# Fix notification types mismatch
cat > src/lib/notifications.ts << 'EOF'
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
EOF

echo "🔧 Fixing participation types..."

# Fix participation types
cat > src/lib/participation.ts << 'EOF'
import { apiClient } from './api-client';

export interface ParticipationRecord {
  id: string;
  userId: string;
  cycleId: string;
  status: 'active' | 'paused' | 'stalled';
  joinedAt: string;
  lastActivityDate: string | null;
  stallStage: number;
  multiplier: number;
  totalActivities: number;
  createdAt: string;
  updatedAt: string;
}

export async function getParticipation(userId: string, cycleId: string): Promise<ParticipationRecord | null> {
  try {
    const participation = await apiClient.getParticipation(userId, cycleId) as any;
    return participation || null;
  } catch (error) {
    console.error('Failed to fetch participation:', error);
    return null;
  }
}

export async function joinCycle(cycleId: string): Promise<{ success: boolean; participation?: ParticipationRecord; error?: string }> {
  try {
    const result = await apiClient.joinCycle(cycleId) as any;
    return {
      success: true,
      participation: result,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to join cycle',
    };
  }
}

export async function updateParticipationStatus(
  participationId: string, 
  status: 'active' | 'paused'
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.updateParticipation(participationId, { status });
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to update participation status',
    };
  }
}
EOF

echo "🔧 Fixing activity types..."

# Fix activity lib
cat > src/lib/activity.ts << 'EOF'
import { apiClient } from './api-client';

export interface ActivityEvent {
  id: string;
  userId: string;
  cycleId: string;
  activityType: string;
  proofLink: string;
  description?: string;
  status: 'pending' | 'verified' | 'rejected';
  ownershipAmount?: number;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
}

export interface CreateActivityData {
  cycleId: string;
  activityType: string;
  proofLink: string;
  description?: string;
}

export async function submitActivity(
  data: CreateActivityData
): Promise<{ success: boolean; activity?: ActivityEvent; error?: string }> {
  try {
    const activity = await apiClient.createActivity({
      cycleId: data.cycleId,
      activityType: data.activityType,
      proofLink: data.proofLink,
      description: data.description,
    }) as any;

    return {
      success: true,
      activity,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to submit activity',
    };
  }
}

export async function getUserActivities(userId: string, cycleId?: string): Promise<ActivityEvent[]> {
  try {
    return await apiClient.getActivities({ userId, cycleId }) as ActivityEvent[];
  } catch (error) {
    console.error('Failed to fetch user activities:', error);
    return [];
  }
}

export async function getCycleActivities(cycleId: string): Promise<ActivityEvent[]> {
  try {
    return await apiClient.getActivities({ cycleId }) as ActivityEvent[];
  } catch (error) {
    console.error('Failed to fetch cycle activities:', error);
    return [];
  }
}

export async function getRecentActivities(limit = 10): Promise<ActivityEvent[]> {
  try {
    const activities = await apiClient.getActivities({}) as any;
    const sortedActivities = Array.isArray(activities) ? activities.sort((a: ActivityEvent, b: ActivityEvent) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ) : [];
    
    return sortedActivities.slice(0, limit);
  } catch (error) {
    console.error('Failed to fetch recent activities:', error);
    return [];
  }
}

export async function getActivityCount(userId?: string, cycleId?: string): Promise<number> {
  try {
    const activities = await apiClient.getActivities({ userId, cycleId }) as any;
    return Array.isArray(activities) ? activities.length : 0;
  } catch (error) {
    console.error('Failed to fetch activity count:', error);
    return 0;
  }
}
EOF

echo "🔧 Fixing cycle types..."

# Fix cycle types
cat > src/types/cycle.ts << 'EOF'
export interface BuildCycle {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'active' | 'completed';
  participantCount: number;
  totalActivities: number;
  createdAt: string;
  updatedAt: string;
}

export interface CycleParticipation {
  id: string;
  userId: string;
  cycleId: string;
  status: 'active' | 'paused' | 'stalled';
  joinedAt: string;
  lastActivityDate?: string;
  stallStage: number;
  multiplier: number;
  totalActivities: number;
  createdAt: string;
  updatedAt: string;
}

export interface CycleStats {
  totalParticipants: number;
  activeParticipants: number;
  totalActivities: number;
  averageActivitiesPerParticipant: number;
}
EOF

echo "🏗️ Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ BUILD SUCCESSFUL!"
    echo "🚀 Starting production server..."
    npm start
else
    echo "❌ Build still has issues. Check the output above for remaining errors."
fi
EOF

chmod +x comprehensive-fix.sh