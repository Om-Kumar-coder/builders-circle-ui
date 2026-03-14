'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../src/context/AuthContext';
import { useCycle } from '../../src/context/CycleContext';
import MainLayout from '../../src/components/layout/MainLayout';
import Link from 'next/link';
import { Shield, Users, Settings, BarChart3, CheckCircle, Clock, RefreshCw, ChevronDown, ChevronUp, ExternalLink, User, Calendar } from 'lucide-react';
import { apiClient } from '../../src/lib/api-client';
import JobExecutionPanel from '../../src/components/admin/JobExecutionPanel';

interface QuickStats {
  pendingActivities: number;
  activeUsers: number;
  activeCycles: number;
  totalActivities: number;
}

interface ActivityEvent {
  id: string;
  activityType: string;
  contributionType: string;
  description: string;
  proofLink: string;
  hoursLogged?: number;
  status: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export default function AdminPage() {
  const { user } = useAuth();
  const { allCycles } = useCycle();
  const [stats, setStats] = useState<QuickStats>({
    pendingActivities: 0,
    activeUsers: 0,
    activeCycles: 0,
    totalActivities: 0
  });
  const [loading, setLoading] = useState(true);
  const [showActivityReview, setShowActivityReview] = useState(false);
  const [pendingActivities, setPendingActivities] = useState<ActivityEvent[]>([]);
  const [verifying, setVerifying] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get analytics data
      const analytics = await apiClient.getDashboardAnalytics();
      
      // Count active cycles
      const activeCycles = allCycles.filter(c => c.state === 'active').length;
      
      setStats({
        pendingActivities: analytics.pendingActivities || 0,
        activeUsers: analytics.activeUsers || 0,
        activeCycles: activeCycles,
        totalActivities: analytics.totalActivities || 0
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      // Set fallback values
      setStats({
        pendingActivities: 0,
        activeUsers: allCycles.reduce((sum, cycle) => sum + cycle.participantCount, 0),
        activeCycles: allCycles.filter(c => c.state === 'active').length,
        totalActivities: 0
      });
    } finally {
      setLoading(false);
    }
  }, [allCycles]);

  const fetchPendingActivities = async () => {
    try {
      const data = await apiClient.getPendingActivities();
      setPendingActivities(data);
    } catch (error) {
      console.error('Error fetching pending activities:', error);
      setPendingActivities([]);
    }
  };

  const handleVerification = async (
    activityId: string,
    status: 'verified' | 'rejected' | 'changes_requested',
    rejectionReason?: string
  ) => {
    try {
      setVerifying(activityId);
      
      await apiClient.verifyActivity(activityId, {
        status,
        rejectionReason
      });

      // Refresh the pending activities list
      await fetchPendingActivities();
      await fetchStats(); // Update stats too
      
    } catch (error) {
      console.error('Error verifying activity:', error);
    } finally {
      setVerifying(null);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [allCycles, fetchStats]);

  useEffect(() => {
    if (showActivityReview) {
      fetchPendingActivities();
    }
  }, [showActivityReview]);

  const adminActions = [
    {
      title: 'Admin Overrides',
      description: 'Manually correct ownership, multipliers, and stall status',
      icon: Shield,
      href: '/admin/overrides',
      color: 'bg-red-600',
    },
    {
      title: 'Dispute Resolution',
      description: 'Review and resolve user disputes',
      icon: Users,
      href: '/admin/disputes',
      color: 'bg-blue-600',
    },
    {
      title: 'Role Management',
      description: 'Manage user roles and permissions',
      icon: Users,
      href: '/admin/roles',
      color: 'bg-purple-600',
    },
    {
      title: 'Audit Logs',
      description: 'View system audit trail',
      icon: Clock,
      href: '/admin/audit',
      color: 'bg-yellow-600',
    },
    {
      title: 'Analytics',
      description: 'View system analytics and reports',
      icon: BarChart3,
      href: '/admin/analytics',
      color: 'bg-indigo-600',
    },
    {
      title: 'Contribution Weights',
      description: 'Configure activity contribution weights',
      icon: Settings,
      href: '/admin/weights',
      color: 'bg-green-600',
    },
  ];

  return (
    <MainLayout title="Admin Dashboard">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-purple-600 p-3 rounded-full">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-gray-400">Welcome, {user?.name}</p>
              </div>
            </div>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 
                border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Quick Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400">Pending Activities</p>
              <p className="text-2xl font-bold text-yellow-400">
                {loading ? '...' : stats.pendingActivities}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400">Active Users</p>
              <p className="text-2xl font-bold text-green-400">
                {loading ? '...' : stats.activeUsers}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400">Active Cycles</p>
              <p className="text-2xl font-bold text-blue-400">
                {loading ? '...' : stats.activeCycles}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400">Total Activities</p>
              <p className="text-2xl font-bold text-indigo-400">
                {loading ? '...' : stats.totalActivities}
              </p>
            </div>
          </div>
        </div>

        {/* Activity Review Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-600 p-2 rounded-lg">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Activity Review</h2>
                <p className="text-gray-400 text-sm">Review and verify submitted activities</p>
              </div>
            </div>
            <button
              onClick={() => setShowActivityReview(!showActivityReview)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 
                text-white rounded-lg transition-colors"
            >
              {showActivityReview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span>{showActivityReview ? 'Hide' : 'Show'} Review Panel</span>
            </button>
          </div>

          {showActivityReview && (
            <div className="mt-6 space-y-4">
              {pendingActivities.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3 opacity-50" />
                  <p className="text-gray-400">No pending activities to review</p>
                </div>
              ) : (
                pendingActivities.map((activity) => (
                  <div key={activity.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-300 font-medium">{activity.user.name}</span>
                          <span className="text-gray-500 text-sm">({activity.user.email})</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-1">
                          {activity.contributionType}
                        </h3>
                        <p className="text-gray-400 mb-3">{activity.description}</p>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(activity.createdAt).toLocaleDateString()}</span>
                          </div>
                          {activity.hoursLogged && (
                            <span>Hours: {activity.hoursLogged}</span>
                          )}
                        </div>

                        <a
                          href={activity.proofLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View Proof
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-4 border-t border-gray-700">
                      <button
                        onClick={() => handleVerification(activity.id, 'verified')}
                        disabled={verifying === activity.id}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 
                          text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      
                      <button
                        onClick={() => handleVerification(activity.id, 'rejected', 'Needs more information')}
                        disabled={verifying === activity.id}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 
                          text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Manual Job Execution Panel */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <JobExecutionPanel onJobComplete={fetchStats} />
        </div>

        {/* Admin Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {adminActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 
                  transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <div className={`${action.color} p-3 rounded-lg group-hover:scale-105 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                      {action.title}
                    </h3>
                    <p className="text-gray-400 text-sm">{action.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}
