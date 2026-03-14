'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Target, TrendingUp, Award } from 'lucide-react';

interface ContributorProgressTrackerProps {
  userId: string;
  cycleId: string;
}

interface ProgressData {
  currentLevel: string;
  nextLevel: string;
  progress: number; // 0-100
  reputationScore: number;
  verifiedActivities: number;
  totalHoursLogged: number;
  consistencyScore: number;
  milestones: {
    name: string;
    target: number;
    current: number;
    completed: boolean;
  }[];
  achievements: {
    id: string;
    name: string;
    description: string;
    unlockedAt: string;
    icon: string;
  }[];
}

export default function ContributorProgressTracker({ userId, cycleId }: ContributorProgressTrackerProps) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProgressData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get user reputation and activities
        const [reputation, activities] = await Promise.all([
          apiClient.getUserReputation(userId).catch(() => null),
          apiClient.getActivities(cycleId).catch(() => [])
        ]);
        
        const userActivities = activities.filter((activity: { userId: string }) => activity.userId === userId);
        const verifiedActivities = userActivities.filter((activity: { status: string }) => activity.status === 'verified');
        const totalHours = userActivities.reduce((sum: number, activity: { hoursLogged?: number }) => sum + (activity.hoursLogged || 0), 0);
        
        // Calculate current level based on reputation score
        const reputationScore = reputation?.reputationScore || 0;
        let currentLevel = 'Newcomer';
        let nextLevel = 'Contributor';
        let progress = 0;
        
        if (reputationScore >= 80) {
          currentLevel = 'Expert';
          nextLevel = 'Master';
          progress = Math.min(100, ((reputationScore - 80) / 20) * 100);
        } else if (reputationScore >= 60) {
          currentLevel = 'Advanced';
          nextLevel = 'Expert';
          progress = ((reputationScore - 60) / 20) * 100;
        } else if (reputationScore >= 40) {
          currentLevel = 'Intermediate';
          nextLevel = 'Advanced';
          progress = ((reputationScore - 40) / 20) * 100;
        } else if (reputationScore >= 20) {
          currentLevel = 'Contributor';
          nextLevel = 'Intermediate';
          progress = ((reputationScore - 20) / 20) * 100;
        } else {
          currentLevel = 'Newcomer';
          nextLevel = 'Contributor';
          progress = (reputationScore / 20) * 100;
        }
        
        // Define milestones
        const milestones = [
          {
            name: 'First Activity',
            target: 1,
            current: userActivities.length,
            completed: userActivities.length >= 1
          },
          {
            name: 'First Verification',
            target: 1,
            current: verifiedActivities.length,
            completed: verifiedActivities.length >= 1
          },
          {
            name: '10 Hours Logged',
            target: 10,
            current: totalHours,
            completed: totalHours >= 10
          },
          {
            name: '5 Verified Activities',
            target: 5,
            current: verifiedActivities.length,
            completed: verifiedActivities.length >= 5
          },
          {
            name: '50 Reputation Points',
            target: 50,
            current: reputationScore,
            completed: reputationScore >= 50
          }
        ];
        
        // Mock achievements (would come from database)
        const achievements = [
          {
            id: '1',
            name: 'First Steps',
            description: 'Submitted your first activity',
            unlockedAt: userActivities.length > 0 ? userActivities[0].createdAt : '',
            icon: '🎯'
          },
          {
            id: '2',
            name: 'Verified Contributor',
            description: 'Got your first activity verified',
            unlockedAt: verifiedActivities.length > 0 ? verifiedActivities[0].verifiedAt : '',
            icon: '✅'
          },
          {
            id: '3',
            name: 'Time Tracker',
            description: 'Logged 10+ hours of work',
            unlockedAt: totalHours >= 10 ? new Date().toISOString() : '',
            icon: '⏰'
          }
        ].filter(achievement => achievement.unlockedAt);
        
        setData({
          currentLevel,
          nextLevel,
          progress,
          reputationScore,
          verifiedActivities: verifiedActivities.length,
          totalHoursLogged: totalHours,
          consistencyScore: reputation?.consistencyScore || 0,
          milestones,
          achievements
        });
      } catch (err) {
        console.error('Error fetching progress data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load progress data');
      } finally {
        setLoading(false);
      }
    };

    if (userId && cycleId) {
      fetchProgressData();
    }
  }, [userId, cycleId]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Newcomer':
        return 'text-gray-400 bg-gray-500/20';
      case 'Contributor':
        return 'text-blue-400 bg-blue-500/20';
      case 'Intermediate':
        return 'text-green-400 bg-green-500/20';
      case 'Advanced':
        return 'text-purple-400 bg-purple-500/20';
      case 'Expert':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'Master':
        return 'text-red-400 bg-red-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-5 h-5 bg-gray-800 rounded"></div>
            <div className="h-6 bg-gray-800 rounded w-40"></div>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-800 rounded"></div>
            <div className="h-8 bg-gray-800 rounded"></div>
            <div className="h-4 bg-gray-800 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-100">Progress Tracker</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="text-center py-8">
          <p className="text-gray-400">No progress data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <Target className="w-5 h-5 text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-100">Progress Tracker</h3>
      </div>

      {/* Current Level */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getLevelColor(data.currentLevel)}`}>
              {data.currentLevel}
            </span>
            <span className="text-gray-400">→</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getLevelColor(data.nextLevel)} opacity-60`}>
              {data.nextLevel}
            </span>
          </div>
          <span className="text-sm text-gray-400">{Math.round(data.progress)}%</span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
            style={{ width: `${data.progress}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-800/50 rounded-lg">
          <TrendingUp className="w-5 h-5 text-blue-400 mx-auto mb-1" />
          <p className="text-lg font-semibold text-gray-100">{data.reputationScore.toFixed(0)}</p>
          <p className="text-xs text-gray-400">Reputation</p>
        </div>
        <div className="text-center p-3 bg-gray-800/50 rounded-lg">
          <Award className="w-5 h-5 text-green-400 mx-auto mb-1" />
          <p className="text-lg font-semibold text-gray-100">{data.verifiedActivities}</p>
          <p className="text-xs text-gray-400">Verified</p>
        </div>
      </div>

      {/* Milestones */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Milestones</h4>
        <div className="space-y-2">
          {data.milestones.slice(0, 3).map((milestone, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  milestone.completed ? 'bg-green-500' : 'bg-gray-600'
                }`} />
                <span className={`text-sm ${
                  milestone.completed ? 'text-gray-300' : 'text-gray-400'
                }`}>
                  {milestone.name}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {milestone.current}/{milestone.target}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Achievements */}
      {data.achievements.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3">Recent Achievements</h4>
          <div className="space-y-2">
            {data.achievements.slice(0, 2).map((achievement) => (
              <div key={achievement.id} className="flex items-center gap-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <span className="text-lg">{achievement.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-yellow-400">{achievement.name}</p>
                  <p className="text-xs text-gray-400 truncate">{achievement.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}