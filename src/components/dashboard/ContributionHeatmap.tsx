'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Calendar } from 'lucide-react';

interface ContributionHeatmapProps {
  userId: string;
  cycleId: string;
}

interface ContributionDay {
  date: string;
  count: number;
  level: number; // 0-4 for intensity
}

export default function ContributionHeatmap({ userId, cycleId }: ContributionHeatmapProps) {
  const [contributions, setContributions] = useState<ContributionDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContributions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get activities for the last 90 days
        const activities = await apiClient.getActivities(cycleId);
        
        // Filter activities for this user
        const userActivities = activities.filter(activity => activity.userId === userId);
        
        // Generate last 90 days
        const days: ContributionDay[] = [];
        const today = new Date();
        
        for (let i = 89; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          
          const dayActivities = userActivities.filter(activity => 
            activity.createdAt.startsWith(dateStr)
          );
          
          const count = dayActivities.length;
          let level = 0;
          
          if (count > 0) {
            if (count >= 4) level = 4;
            else if (count >= 3) level = 3;
            else if (count >= 2) level = 2;
            else level = 1;
          }
          
          days.push({
            date: dateStr,
            count,
            level
          });
        }
        
        setContributions(days);
      } catch (err) {
        console.error('Error fetching contribution data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load contribution data');
      } finally {
        setLoading(false);
      }
    };

    if (userId && cycleId) {
      fetchContributions();
    }
  }, [userId, cycleId]);

  const getLevelColor = (level: number) => {
    switch (level) {
      case 0: return 'bg-gray-800';
      case 1: return 'bg-green-900';
      case 2: return 'bg-green-700';
      case 3: return 'bg-green-500';
      case 4: return 'bg-green-400';
      default: return 'bg-gray-800';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-100">Contribution Activity</h3>
        </div>
        <div className="animate-pulse">
          <div className="grid grid-cols-13 gap-1">
            {[...Array(90)].map((_, i) => (
              <div key={i} className="w-3 h-3 bg-gray-800 rounded-sm"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-100">Contribution Activity</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const totalContributions = contributions.reduce((sum, day) => sum + day.count, 0);
  const activedays = contributions.filter(day => day.count > 0).length;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-100">Contribution Activity</h3>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Last 90 days</p>
          <p className="text-lg font-semibold text-gray-100">{totalContributions} contributions</p>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="mb-4">
        <div className="grid grid-cols-13 gap-1 mb-2">
          {contributions.map((day) => (
            <div
              key={day.date}
              className={`w-3 h-3 rounded-sm ${getLevelColor(day.level)} hover:ring-2 hover:ring-gray-400 transition-all cursor-pointer`}
              title={`${formatDate(day.date)}: ${day.count} contributions`}
            />
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Less</span>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-gray-800 rounded-sm"></div>
            <div className="w-2 h-2 bg-green-900 rounded-sm"></div>
            <div className="w-2 h-2 bg-green-700 rounded-sm"></div>
            <div className="w-2 h-2 bg-green-500 rounded-sm"></div>
            <div className="w-2 h-2 bg-green-400 rounded-sm"></div>
          </div>
          <span>More</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
        <div>
          <p className="text-sm text-gray-400">Active Days</p>
          <p className="text-lg font-semibold text-gray-100">{activedays}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Avg per Day</p>
          <p className="text-lg font-semibold text-gray-100">
            {activedays > 0 ? (totalContributions / activedays).toFixed(1) : '0'}
          </p>
        </div>
      </div>
    </div>
  );
}