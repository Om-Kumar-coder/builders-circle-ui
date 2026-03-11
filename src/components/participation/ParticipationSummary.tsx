'use client';

import { useEffect, useState } from 'react';
import { getParticipationStatus } from '@/lib/participation';
import type { ParticipationRecord } from '@/lib/participation';
import ParticipationBadge from './ParticipationBadge';
import { Activity, AlertCircle, Clock } from 'lucide-react';
import Link from 'next/link';

interface ParticipationSummaryProps {
  userId: string;
}

export default function ParticipationSummary({ userId }: ParticipationSummaryProps) {
  const [loading, setLoading] = useState(true);
  const [participations, setParticipations] = useState<ParticipationRecord[]>([]);
  const [stats, setStats] = useState({
    activeCount: 0,
    atRiskCount: 0,
    graceCount: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const status = await getParticipationStatus(userId);
      setParticipations(status.participations);
      setStats({
        activeCount: status.activeCount,
        atRiskCount: status.atRiskCount,
        graceCount: status.graceCount,
      });
      setLoading(false);
    };

    fetchData();
  }, [userId]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No activity yet';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return 'No activity yet';
    
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return formatDate(dateString);
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Active Participation</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-800 rounded w-3/4"></div>
          <div className="h-4 bg-gray-800 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (participations.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Active Participation</h2>
        <div className="text-center py-8">
          <div className="text-5xl mb-3 opacity-50">🚀</div>
          <p className="text-gray-400 mb-4">You are not participating in any active builds.</p>
          <Link
            href="/build-cycles"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Browse Build Cycles
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 className="text-xl font-semibold text-gray-100 mb-4">Active Participation</h2>

      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Activity className="w-4 h-4 text-green-400" />
            <span className="text-2xl font-bold text-green-400">{stats.activeCount}</span>
          </div>
          <p className="text-xs text-gray-400">Active</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-2xl font-bold text-blue-400">{stats.graceCount}</span>
          </div>
          <p className="text-xs text-gray-400">Grace</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <span className="text-2xl font-bold text-yellow-400">{stats.atRiskCount}</span>
          </div>
          <p className="text-xs text-gray-400">At Risk</p>
        </div>
      </div>

      {/* Participation List */}
      <div className="space-y-3">
        {participations.map((participation) => (
          <Link
            key={participation.id}
            href={`/build-cycles/${participation.cycleId}`}
            className="block bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-lg p-4 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-medium text-gray-100">Build Cycle</h3>
              <ParticipationBadge participation={participation} size="sm" />
            </div>
            <div className="space-y-1 text-sm text-gray-400">
              <div className="flex justify-between">
                <span>Last Activity:</span>
                <span className="text-gray-300">{formatTimeAgo(participation.lastActivityDate)}</span>
              </div>
              <div className="flex justify-between">
                <span>Stall Stage:</span>
                <span className="text-gray-300 capitalize">{participation.stallStage}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
