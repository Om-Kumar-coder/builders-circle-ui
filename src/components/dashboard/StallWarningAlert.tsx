'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import { AlertTriangle, Clock, X, Activity } from 'lucide-react';

interface StallWarning {
  cycleId: string;
  cycleName: string;
  stallStage: string;
  daysSinceLastActivity: number;
  daysUntilNextStage: number;
  nextStage: string;
}

export default function StallWarningAlert() {
  const { user } = useAuth();
  const [warnings, setWarnings] = useState<StallWarning[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchStallWarnings = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get user's active participations
      const participations = await apiClient.getUserParticipations(user.id);
      
      const activeParticipations = participations.filter((p: { cycle: { state: string }; optedIn: boolean }) => 
        p.cycle.state === 'active' && p.optedIn
      );

      const warningsToShow: StallWarning[] = [];

      for (const participation of activeParticipations) {
        const daysSinceLastActivity = participation.lastActivityDate 
          ? Math.floor((Date.now() - new Date(participation.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24))
          : Math.floor((Date.now() - new Date(participation.createdAt).getTime()) / (1000 * 60 * 60 * 24));

        // Calculate days until next stall stage
        let daysUntilNextStage = 0;
        let nextStage = '';

        switch (participation.stallStage) {
          case 'active':
            if (daysSinceLastActivity >= 5) { // Warn 2 days before at_risk (7 days)
              daysUntilNextStage = 7 - daysSinceLastActivity;
              nextStage = 'at_risk';
            }
            break;
          case 'grace':
            if (daysSinceLastActivity >= 5) { // Warn 2 days before at_risk
              daysUntilNextStage = 7 - daysSinceLastActivity;
              nextStage = 'at_risk';
            }
            break;
          case 'at_risk':
            if (daysSinceLastActivity >= 12) { // Warn 2 days before diminishing (14 days)
              daysUntilNextStage = 14 - daysSinceLastActivity;
              nextStage = 'diminishing';
            }
            break;
          case 'diminishing':
            if (daysSinceLastActivity >= 18) { // Warn 2 days before paused (20 days)
              daysUntilNextStage = 20 - daysSinceLastActivity;
              nextStage = 'paused';
            }
            break;
        }

        if (nextStage && daysUntilNextStage <= 2 && daysUntilNextStage >= 0) {
          warningsToShow.push({
            cycleId: participation.cycleId,
            cycleName: participation.cycle.name,
            stallStage: participation.stallStage,
            daysSinceLastActivity,
            daysUntilNextStage,
            nextStage
          });
        }
      }

      setWarnings(warningsToShow);
    } catch (error) {
      console.error('Error fetching stall warnings:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStallWarnings();
    
    // Check for warnings every 30 minutes
    const interval = setInterval(fetchStallWarnings, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStallWarnings]);

  const dismissWarning = (cycleId: string) => {
    setDismissed(prev => new Set(prev).add(cycleId));
    
    // Store dismissal in localStorage with timestamp
    const dismissals = JSON.parse(localStorage.getItem('stall-warning-dismissals') || '{}');
    dismissals[cycleId] = Date.now();
    localStorage.setItem('stall-warning-dismissals', JSON.stringify(dismissals));
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'at_risk':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'diminishing':
        return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      case 'paused':
        return 'text-red-400 bg-red-500/20 border-red-500/30';
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const getUrgencyColor = (daysUntil: number) => {
    if (daysUntil === 0) return 'border-red-500/50 bg-red-500/10';
    if (daysUntil === 1) return 'border-orange-500/50 bg-orange-500/10';
    return 'border-yellow-500/50 bg-yellow-500/10';
  };

  // Filter out dismissed warnings (dismiss for 24 hours)
  const activeWarnings = warnings.filter(warning => {
    if (dismissed.has(warning.cycleId)) return false;
    
    const dismissals = JSON.parse(localStorage.getItem('stall-warning-dismissals') || '{}');
    const dismissedAt = dismissals[warning.cycleId];
    
    if (dismissedAt && Date.now() - dismissedAt < 24 * 60 * 60 * 1000) {
      return false; // Still within 24-hour dismissal period
    }
    
    return true;
  });

  if (loading || activeWarnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {activeWarnings.map((warning) => (
        <div
          key={warning.cycleId}
          className={`border rounded-lg p-4 ${getUrgencyColor(warning.daysUntilNextStage)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-gray-100">Stall Warning</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStageColor(warning.nextStage)}`}>
                    {warning.nextStage.replace('_', ' ')}
                  </span>
                </div>
                
                <p className="text-sm text-gray-300 mb-2">
                  <strong>{warning.cycleName}</strong> - Your participation status will change to{' '}
                  <span className="font-medium text-yellow-400">{warning.nextStage.replace('_', ' ')}</span>
                  {warning.daysUntilNextStage === 0 ? (
                    <span className="text-red-400 font-medium"> today</span>
                  ) : warning.daysUntilNextStage === 1 ? (
                    <span className="text-orange-400 font-medium"> tomorrow</span>
                  ) : (
                    <span className="text-yellow-400 font-medium"> in {warning.daysUntilNextStage} days</span>
                  )}
                </p>

                <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{warning.daysSinceLastActivity} days since last activity</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    <span>Current: {warning.stallStage}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="/activity"
                    className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 
                      text-white text-xs rounded-lg font-medium transition-colors"
                  >
                    <Activity className="w-3 h-3" />
                    Submit Activity
                  </a>
                  <span className="text-xs text-gray-500">to maintain your participation status</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => dismissWarning(warning.cycleId)}
              className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
              aria-label="Dismiss warning"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}