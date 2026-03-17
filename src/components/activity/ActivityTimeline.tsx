'use client';

import { useState, useEffect } from 'react';
import { getUserCycleActivity } from '@/lib/activity';
import { ActivityEvent, STATUS_CONFIG } from '@/types/activity';
import ActivityItem from './ActivityItem';

interface ActivityTimelineProps {
  userId: string;
  cycleId: string;
  refreshTrigger?: number;
}

function groupByDate(activities: ActivityEvent[]): [string, ActivityEvent[]][] {
  const map = new Map<string, ActivityEvent[]>();
  for (const a of activities) {
    const key = new Date(a.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return Array.from(map.entries());
}

const STATUS_DOT: Record<string, string> = {
  verified: 'bg-green-400',
  pending: 'bg-yellow-400',
  rejected: 'bg-red-400',
  changes_requested: 'bg-orange-400',
};

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
      } catch (err: unknown) {
        setError((err as Error).message || 'Failed to load activities');
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
                <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
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
        <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-md text-sm">{error}</div>
      </div>
    );
  }

  const groups = groupByDate(activities);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-100">Activity Timeline</h2>
        <span className="text-sm text-gray-400">
          {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4 opacity-50">📋</div>
          <p className="text-gray-400 mb-2">No activities yet</p>
          <p className="text-sm text-gray-500">Submit your first activity to start tracking your progress</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(([date, items]) => (
            <div key={date}>
              {/* Date label */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-gray-800" />
                <span className="text-xs font-medium text-gray-500 px-2">{date}</span>
                <div className="h-px flex-1 bg-gray-800" />
              </div>

              {/* Timeline items */}
              <div className="relative pl-6">
                {/* Vertical line */}
                <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-800" />

                <div className="space-y-4">
                  {items.map((activity, idx) => (
                    <div key={activity.id} className="relative">
                      {/* Timeline dot */}
                      <div className={`absolute -left-4 top-4 w-3 h-3 rounded-full border-2 border-gray-900 ${STATUS_DOT[activity.status] ?? 'bg-gray-500'} z-10`} />
                      {/* Connector line between items */}
                      {idx < items.length - 1 && (
                        <div className="absolute -left-[13px] top-7 w-px h-full bg-gray-800" />
                      )}
                      <ActivityItem activity={activity} />
                      {/* Status label inline with dot */}
                      <div className="absolute -left-[52px] top-3.5 hidden md:block">
                        <span className={`text-[10px] font-medium ${STATUS_CONFIG[activity.status]?.color ?? 'text-gray-500'}`}>
                          {new Date(activity.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
