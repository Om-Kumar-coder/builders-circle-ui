'use client';

import { useState, useEffect } from 'react';
import { getUserCycleActivity, type ActivityEvent } from '@/lib/activity';
import ActivityItem from './ActivityItem';

interface ActivityTimelineProps {
  userId: string;
  cycleId: string;
  refreshTrigger?: number;
}

export default function ActivityTimeline({ userId, cycleId, refreshTrigger = 0 }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchActivities = async () => {
      setLoading(true);
      setError('');
      
      try {
        const data = await getUserCycleActivity(userId, cycleId);
        setActivities(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load activities');
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [userId, cycleId, refreshTrigger]);

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Activity Timeline</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-700 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-1/3"></div>
                  <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Activity Timeline</h2>
        <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-100">Activity Timeline</h2>
        <span className="text-sm text-gray-400">
          {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4 opacity-50">📋</div>
          <p className="text-gray-400 mb-2">No activities yet</p>
          <p className="text-sm text-gray-500">
            Submit your first activity to start tracking your progress
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </div>
  );
}
