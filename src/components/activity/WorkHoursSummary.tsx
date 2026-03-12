'use client';

import { useState, useEffect } from 'react';
import { getWorkHoursSummary } from '@/lib/activity';
import { Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface WorkHoursSummaryProps {
  userId: string;
  cycleId: string;
}

interface HoursSummary {
  totalHours: number;
  verifiedHours: number;
  pendingHours: number;
  rejectedHours: number;
}

export default function WorkHoursSummary({ userId, cycleId }: WorkHoursSummaryProps) {
  const [summary, setSummary] = useState<HoursSummary>({
    totalHours: 0,
    verifiedHours: 0,
    pendingHours: 0,
    rejectedHours: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!userId || !cycleId) return;
      
      try {
        setLoading(true);
        setError(null);
        const data = await getWorkHoursSummary(userId, cycleId);
        setSummary(data);
      } catch (err: any) {
        console.error('Error fetching work hours summary:', err);
        setError(err.message || 'Failed to fetch work hours summary');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [userId, cycleId]);

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-6 h-6 text-indigo-400" />
          <h3 className="text-lg font-semibold text-gray-100">Work Hours Summary</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-800/50 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded mb-2"></div>
              <div className="h-6 bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-6 h-6 text-indigo-400" />
          <h3 className="text-lg font-semibold text-gray-100">Work Hours Summary</h3>
        </div>
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-6 h-6 text-indigo-400" />
        <h3 className="text-lg font-semibold text-gray-100">Work Hours Summary</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Hours */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <p className="text-sm text-gray-400">Total Hours</p>
          </div>
          <p className="text-2xl font-bold text-gray-100">{summary.totalHours.toFixed(1)}</p>
        </div>

        {/* Verified Hours */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <p className="text-sm text-gray-400">Verified</p>
          </div>
          <p className="text-2xl font-bold text-green-400">{summary.verifiedHours.toFixed(1)}</p>
        </div>

        {/* Pending Hours */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <p className="text-sm text-gray-400">Pending</p>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{summary.pendingHours.toFixed(1)}</p>
        </div>

        {/* Rejected Hours */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <p className="text-sm text-gray-400">Rejected</p>
          </div>
          <p className="text-2xl font-bold text-red-400">{summary.rejectedHours.toFixed(1)}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {summary.totalHours > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
            <span>Verification Progress</span>
            <span>{((summary.verifiedHours / summary.totalHours) * 100).toFixed(1)}% verified</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div className="flex h-2 rounded-full overflow-hidden">
              <div 
                className="bg-green-500 transition-all duration-300"
                style={{ width: `${(summary.verifiedHours / summary.totalHours) * 100}%` }}
              />
              <div 
                className="bg-yellow-500 transition-all duration-300"
                style={{ width: `${(summary.pendingHours / summary.totalHours) * 100}%` }}
              />
              <div 
                className="bg-red-500 transition-all duration-300"
                style={{ width: `${(summary.rejectedHours / summary.totalHours) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* No Hours Message */}
      {summary.totalHours === 0 && (
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No hours logged yet</p>
          <p className="text-sm text-gray-500 mt-1">Submit activities with hour tracking to see your progress</p>
        </div>
      )}
    </div>
  );
}