'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Shield, AlertTriangle, Clock, TrendingDown } from 'lucide-react';

interface AccountabilityStatusProps {
  userId: string;
  cycleId: string;
}

interface AccountabilityData {
  stallStage: string;
  participationStatus: string;
  lastActivityDate: string | null;
  multiplier: number;
  daysInCurrentStage: number;
  nextThreshold: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export default function AccountabilityStatus({ userId, cycleId }: AccountabilityStatusProps) {
  const [data, setData] = useState<AccountabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccountabilityData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get participation data
        const participation = await apiClient.getParticipation(cycleId);
        
        // Get ownership data for multiplier
        const ownership = await apiClient.getOwnership(userId, cycleId);
        
        // Calculate days since last activity
        const lastActivityDate = participation.lastActivityDate;
        const daysSinceActivity = lastActivityDate 
          ? Math.floor((Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        
        // Determine risk level and next threshold
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        let nextThreshold = '';
        
        switch (participation.stallStage) {
          case 'active':
            riskLevel = 'low';
            nextThreshold = `At risk in ${Math.max(0, 7 - daysSinceActivity)} days`;
            break;
          case 'grace':
            riskLevel = 'low';
            nextThreshold = `At risk in ${Math.max(0, 7 - daysSinceActivity)} days`;
            break;
          case 'at_risk':
            riskLevel = 'medium';
            nextThreshold = `Diminishing in ${Math.max(0, 14 - daysSinceActivity)} days`;
            break;
          case 'diminishing':
            riskLevel = 'high';
            nextThreshold = `Paused in ${Math.max(0, 21 - daysSinceActivity)} days`;
            break;
          case 'paused':
            riskLevel = 'critical';
            nextThreshold = 'Submit activity to recover';
            break;
          default:
            riskLevel = 'low';
            nextThreshold = 'Status unknown';
        }
        
        setData({
          stallStage: participation.stallStage,
          participationStatus: participation.participationStatus,
          lastActivityDate: participation.lastActivityDate,
          multiplier: ownership.multiplier || 1.0,
          daysInCurrentStage: daysSinceActivity,
          nextThreshold,
          riskLevel
        });
      } catch (err) {
        console.error('Error fetching accountability data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load accountability status');
      } finally {
        setLoading(false);
      }
    };

    if (userId && cycleId) {
      fetchAccountabilityData();
    }
  }, [userId, cycleId]);

  const getStatusConfig = (stallStage: string) => {
    switch (stallStage) {
      case 'active':
        return {
          icon: Shield,
          color: 'text-green-400',
          bgColor: 'bg-green-500/20',
          borderColor: 'border-green-500/30',
          title: 'Active Participation'
        };
      case 'grace':
        return {
          icon: Shield,
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/20',
          borderColor: 'border-blue-500/30',
          title: 'Grace Period'
        };
      case 'at_risk':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/20',
          borderColor: 'border-yellow-500/30',
          title: 'At Risk'
        };
      case 'diminishing':
        return {
          icon: TrendingDown,
          color: 'text-orange-400',
          bgColor: 'bg-orange-500/20',
          borderColor: 'border-orange-500/30',
          title: 'Diminishing Returns'
        };
      case 'paused':
        return {
          icon: Clock,
          color: 'text-red-400',
          bgColor: 'bg-red-500/20',
          borderColor: 'border-red-500/30',
          title: 'Participation Paused'
        };
      default:
        return {
          icon: Shield,
          color: 'text-gray-400',
          bgColor: 'bg-gray-500/20',
          borderColor: 'border-gray-500/30',
          title: 'Unknown Status'
        };
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-800 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-800 rounded"></div>
            <div className="h-4 bg-gray-800 rounded w-3/4"></div>
            <div className="h-4 bg-gray-800 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="text-center py-8">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="text-center py-8">
          <p className="text-gray-400">No accountability data available</p>
        </div>
      </div>
    );
  }

  const config = getStatusConfig(data.stallStage);
  const Icon = config.icon;

  return (
    <div className={`bg-gray-900 border rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${config.borderColor}`}>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-100">{config.title}</h3>
            <p className="text-sm text-gray-400">Accountability Status</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
          {data.stallStage.replace('_', ' ').toUpperCase()}
        </div>
      </div>

      <div className="space-y-4">
        {/* Multiplier Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Current Multiplier</span>
          <span className={`text-lg font-bold ${
            data.multiplier >= 1.0 ? 'text-green-400' : 
            data.multiplier >= 0.75 ? 'text-yellow-400' : 
            data.multiplier >= 0.5 ? 'text-orange-400' : 'text-red-400'
          }`}>
            {data.multiplier.toFixed(1)}x
          </span>
        </div>

        {/* Last Activity */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Last Activity</span>
          <span className="text-sm text-gray-200">
            {data.lastActivityDate 
              ? `${data.daysInCurrentStage} days ago`
              : 'No activity yet'
            }
          </span>
        </div>

        {/* Next Threshold */}
        <div className={`p-3 rounded-lg border ${config.borderColor} ${config.bgColor}`}>
          <div className="flex items-center gap-2 mb-1">
            <Clock className={`w-4 h-4 ${config.color}`} />
            <span className="text-sm font-medium text-gray-200">Next Threshold</span>
          </div>
          <p className={`text-sm ${config.color}`}>{data.nextThreshold}</p>
        </div>

        {/* Action Button */}
        {data.stallStage !== 'active' && (
          <button
            onClick={() => window.location.href = '/activity'}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
          >
            Submit Activity to Improve Status
          </button>
        )}
      </div>
    </div>
  );
}