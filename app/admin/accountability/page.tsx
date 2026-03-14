'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { 
  Play, 
  RefreshCw, 
  Users, 
  AlertTriangle, 
  TrendingDown, 
  Clock, 
  CheckCircle,
  Shield,
  Activity,
  Settings
} from 'lucide-react';

interface AccountabilityStatus {
  totalParticipants: number;
  stallStageDistribution: {
    grace: number;
    active: number;
    at_risk: number;
    diminishing: number;
    paused: number;
  };
  recentActivity: {
    decayEvents: number;
    recoveries: number;
  };
}

export default function AccountabilityAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<AccountabilityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobRunning, setJobRunning] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getAccountabilityStatus();
      if (data) {
        setStatus(data);
      } else {
        setError('Failed to fetch status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role && ['admin', 'founder'].includes(user.role)) {
      fetchStatus();
    }
  }, [user]);

  const runJob = async (jobType: string, jobFunction: () => Promise<{ success?: boolean; message?: string; error?: string }>) => {
    try {
      setJobRunning(jobType);
      await jobFunction();
      alert(`${jobType} completed successfully!`);
      await fetchStatus(); // Refresh status
    } catch (err) {
      alert(`${jobType} failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setJobRunning(null);
    }
  };

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user || !user.role || !['admin', 'founder'].includes(user.role)) {
    return (
      <MainLayout title="Accountability Management">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400">Access denied. Admin privileges required.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Accountability Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-100">Accountability Automation</h1>
            <p className="text-gray-400 mt-1">Monitor and manage the accountability system</p>
          </div>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 
              border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {loading && !status ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-800 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-800 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : status ? (
          <>
            {/* Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  <h3 className="font-medium text-gray-100">Total Participants</h3>
                </div>
                <p className="text-3xl font-bold text-blue-400">{status.totalParticipants}</p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <h3 className="font-medium text-gray-100">Active</h3>
                </div>
                <p className="text-3xl font-bold text-green-400">{status.stallStageDistribution.active}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {((status.stallStageDistribution.active / status.totalParticipants) * 100).toFixed(1)}%
                </p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  <h3 className="font-medium text-gray-100">At Risk</h3>
                </div>
                <p className="text-3xl font-bold text-yellow-400">{status.stallStageDistribution.at_risk}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {((status.stallStageDistribution.at_risk / status.totalParticipants) * 100).toFixed(1)}%
                </p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingDown className="w-5 h-5 text-red-400" />
                  <h3 className="font-medium text-gray-100">Decaying</h3>
                </div>
                <p className="text-3xl font-bold text-red-400">
                  {status.stallStageDistribution.diminishing + status.stallStageDistribution.paused}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {(((status.stallStageDistribution.diminishing + status.stallStageDistribution.paused) / status.totalParticipants) * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Stall Stage Distribution */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-gray-100 mb-4">Stall Stage Distribution</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <span className="text-gray-300">Grace Period</span>
                    </div>
                    <span className="text-blue-400 font-medium">{status.stallStageDistribution.grace}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-gray-300">Active</span>
                    </div>
                    <span className="text-green-400 font-medium">{status.stallStageDistribution.active}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <span className="text-gray-300">At Risk</span>
                    </div>
                    <span className="text-yellow-400 font-medium">{status.stallStageDistribution.at_risk}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-orange-400" />
                      <span className="text-gray-300">Diminishing</span>
                    </div>
                    <span className="text-orange-400 font-medium">{status.stallStageDistribution.diminishing}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-red-400" />
                      <span className="text-gray-300">Paused</span>
                    </div>
                    <span className="text-red-400 font-medium">{status.stallStageDistribution.paused}</span>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-gray-100 mb-4">Recent Activity (7 days)</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-400" />
                      <span className="text-gray-300">Decay Events</span>
                    </div>
                    <span className="text-red-400 font-medium">{status.recentActivity.decayEvents}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-green-400" />
                      <span className="text-gray-300">Recoveries</span>
                    </div>
                    <span className="text-green-400 font-medium">{status.recentActivity.recoveries}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Manual Job Controls */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">Manual Job Execution</h3>
              <p className="text-gray-400 text-sm mb-6">
                These jobs normally run automatically on schedule. Use manual execution for testing or immediate updates.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => runJob('Stall Evaluator', () => apiClient.runStallEvaluator())}
                  disabled={jobRunning !== null}
                  className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 
                    disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-lg transition-colors"
                >
                  {jobRunning === 'Stall Evaluator' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  <span>Stall Evaluator</span>
                </button>

                <button
                  onClick={() => runJob('Multiplier Adjustment', () => apiClient.runMultiplierAdjustment())}
                  disabled={jobRunning !== null}
                  className="flex items-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 
                    disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-lg transition-colors"
                >
                  {jobRunning === 'Multiplier Adjustment' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Settings className="w-4 h-4" />
                  )}
                  <span>Multiplier Adjust</span>
                </button>

                <button
                  onClick={() => runJob('Ownership Decay', () => apiClient.runOwnershipDecay())}
                  disabled={jobRunning !== null}
                  className="flex items-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 
                    disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-lg transition-colors"
                >
                  {jobRunning === 'Ownership Decay' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span>Ownership Decay</span>
                </button>

                <button
                  onClick={() => runJob('Cycle Finalizer', () => apiClient.runCycleFinalizer())}
                  disabled={jobRunning !== null}
                  className="flex items-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 
                    disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-lg transition-colors"
                >
                  {jobRunning === 'Cycle Finalizer' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Shield className="w-4 h-4" />
                  )}
                  <span>Cycle Finalizer</span>
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </MainLayout>
  );
}